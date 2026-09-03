import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  AllocationExceedsObligationError,
  BookingNotFoundError,
  ForbiddenActionError,
  InvalidPaymentStateError,
  ObligationNotFoundError,
  ObligationsAlreadyExistError,
  PaymentNotFoundError,
} from '../domain/errors';
import { createRazorpayOrder, refundGatewayPayment } from './razorpayService';
import { sendNotification } from './notificationService';
import { assertStaffVerified } from './staffService';

interface BookingRow {
  booking_id: string;
  turf_id: string;
  booked_by: string;
  booking_date: string;
  start_time: string;
  booking_amount: string;
  booking_status: string;
}

async function fetchBooking(bookingId: string): Promise<BookingRow | null> {
  const [booking] = await sequelize.query<BookingRow>(
    'SELECT * FROM bookings WHERE booking_id = :bookingId',
    { type: QueryTypes.SELECT, replacements: { bookingId } },
  );
  return booking ?? null;
}

export interface ObligationShare {
  playerId: string | null;
  amount: number;
}

// Creates the payment_obligations for a booking. `shares` expresses the
// obligation STRUCTURE (who owes what) — orthogonal to which instrument
// (UPI/Gateway/Cash) is later used to actually settle each one:
//  - omitted => one obligation, player_id NULL ("booker owes the full
//    amount"), used for UPI/Gateway/Cash/Captain-Pays booking modes.
//  - provided => one obligation per share, used for Split Payment. Module
//    2.4 only exposes even-N-way or explicit-amount splits by whoever is
//    creating the obligations; splitting by an actual match/team roster is
//    module 2.6's job — this is the payment surface that module calls into.
export async function createObligationsForBooking(
  bookingId: string,
  actorUserId: string,
  shares?: ObligationShare[],
) {
  const booking = await fetchBooking(bookingId);
  if (!booking) throw new BookingNotFoundError(bookingId);
  if (booking.booked_by !== actorUserId) {
    throw new ForbiddenActionError('Only the person who booked can set up payment obligations.');
  }

  const [existing] = await sequelize.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM payment_obligations WHERE booking_id = :bookingId',
    { type: QueryTypes.SELECT, replacements: { bookingId } },
  );
  if (Number(existing.count) > 0) throw new ObligationsAlreadyExistError();

  const bookingAmount = Number(booking.booking_amount);
  const resolvedShares: ObligationShare[] = shares?.length
    ? shares
    : [{ playerId: null, amount: bookingAmount }];

  const shareTotal = resolvedShares.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(shareTotal - bookingAmount) > 0.01) {
    throw new AllocationExceedsObligationError();
  }

  const now = new Date();
  const rows = resolvedShares.map((share) => ({
    obligation_id: randomUUID(),
    booking_id: bookingId,
    player_id: share.playerId,
    amount_due: share.amount,
    due_status: 'PENDING',
    created_at: now,
    updated_at: now,
  }));

  await sequelize.getQueryInterface().bulkInsert('payment_obligations', rows);
  return rows;
}

interface ObligationRow {
  obligation_id: string;
  booking_id: string;
  player_id: string | null;
  amount_due: string;
  due_status: string;
}

export async function getObligationsForBooking(bookingId: string): Promise<ObligationRow[]> {
  return sequelize.query<ObligationRow>(
    'SELECT * FROM payment_obligations WHERE booking_id = :bookingId ORDER BY created_at ASC',
    { type: QueryTypes.SELECT, replacements: { bookingId } },
  );
}

async function fetchObligations(obligationIds: string[]): Promise<ObligationRow[]> {
  if (obligationIds.length === 0) return [];
  return sequelize.query<ObligationRow>(
    'SELECT * FROM payment_obligations WHERE obligation_id IN (:ids)',
    { type: QueryTypes.SELECT, replacements: { ids: obligationIds } },
  );
}

// Every obligation named must exist, still be unpaid, and this payment must
// settle it in full — module 2.4 settles one or more *whole* obligations per
// payment (e.g. a Captain-Pays payment settling every obligation on a
// booking at once); it does not support a partial payment toward a single
// obligation. "Partial collection" in the split-payment sense means
// different obligations on the same booking are settled at different times
// by different people, which this does support.
async function assertObligationsSettleable(obligations: ObligationRow[], requestedIds: string[]) {
  const foundIds = new Set(obligations.map((o) => o.obligation_id));
  for (const id of requestedIds) {
    if (!foundIds.has(id)) throw new ObligationNotFoundError(id);
  }
  for (const obligation of obligations) {
    if (obligation.due_status === 'PAID') {
      throw new InvalidPaymentStateError(
        `Obligation ${obligation.obligation_id} has already been paid.`,
      );
    }
  }
}

function sumAmountDue(obligations: ObligationRow[]): number {
  return obligations.reduce((sum, o) => sum + Number(o.amount_due), 0);
}

export interface GatewayPaymentInitiation {
  payment_id: string;
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

// Starts a UPI or Payment Gateway payment (PRD §12.16) — both route through
// the same Razorpay order + Checkout flow; `paymentMethod` only tags which
// selector option the payer used, for reconciliation/reporting.
export async function initiateGatewayPayment(
  obligationIds: string[],
  payerId: string,
  paymentMethod: 'UPI' | 'RAZORPAY',
): Promise<GatewayPaymentInitiation> {
  const obligations = await fetchObligations(obligationIds);
  await assertObligationsSettleable(obligations, obligationIds);

  const amount = sumAmountDue(obligations);
  const paymentId = randomUUID();
  const now = new Date();

  // Razorpay echoes `notes` back on every webhook event for this order —
  // this is how the webhook handler (which only knows the gateway's own
  // order/payment ids) finds out which of our obligations to allocate to
  // once the payment is confirmed.
  const order = await createRazorpayOrder(amount, paymentId, {
    bfam_payment_id: paymentId,
    obligation_ids: JSON.stringify(obligationIds),
  });

  await sequelize.getQueryInterface().bulkInsert('payments', [
    {
      payment_id: paymentId,
      payer_id: payerId,
      amount,
      currency: 'INR',
      payment_method: paymentMethod,
      gateway: 'RAZORPAY',
      gateway_order_id: order.order_id,
      gateway_payment_id: null,
      collected_by: null,
      cash_reference: null,
      payment_status: 'PENDING',
      initiated_at: now,
      completed_at: null,
    },
  ]);

  return {
    payment_id: paymentId,
    order_id: order.order_id,
    amount,
    currency: 'INR',
    key_id: order.key_id,
  };
}

// Records a cash payment (PRD §12.16 / this module's requirement 3):
// SUCCESS immediately (no gateway round-trip), collected_by required,
// cash_reference optional free text for reconciliation.
export async function recordCashPayment(
  obligationIds: string[],
  payerId: string,
  collectedBy: string,
  cashReference: string | undefined,
) {
  // Staff verification gate (module 2.12, PRD §32.14) — only applies when
  // the collector is actually staff; a PLAYER captain collecting cash from
  // teammates is unaffected.
  const [collector] = await sequelize.query<{ role: string }>(
    'SELECT role FROM users WHERE user_id = :collectedBy',
    { type: QueryTypes.SELECT, replacements: { collectedBy } },
  );
  if (collector?.role === 'TURF_STAFF') {
    await assertStaffVerified(collectedBy);
  }

  const obligations = await fetchObligations(obligationIds);
  await assertObligationsSettleable(obligations, obligationIds);

  const amount = sumAmountDue(obligations);
  const paymentId = randomUUID();
  const now = new Date();

  await sequelize.getQueryInterface().bulkInsert('payments', [
    {
      payment_id: paymentId,
      payer_id: payerId,
      amount,
      currency: 'INR',
      payment_method: 'CASH',
      gateway: 'CASH',
      gateway_order_id: `CASH-${paymentId}`,
      gateway_payment_id: null,
      collected_by: collectedBy,
      cash_reference: cashReference ?? null,
      payment_status: 'SUCCESS',
      initiated_at: now,
      completed_at: now,
    },
  ]);

  await allocatePaymentToObligations(paymentId, obligations);

  return await fetchPayment(paymentId);
}

// Applies a SUCCESSFUL payment's amount across the obligations it settles
// (payment_obligations -> payments -> payment_allocations, per this
// module's requirement 4), marking each obligation PAID. Never allocates
// more than an obligation's amount_due (AllocationExceedsObligationError),
// which is what keeps split-payment math honest even though every
// obligation here is always settled in full by construction.
export async function allocatePaymentToObligations(
  paymentId: string,
  obligations: ObligationRow[],
) {
  const now = new Date();
  const allocationRows = obligations.map((obligation) => {
    const amount = Number(obligation.amount_due);
    return {
      allocation_id: randomUUID(),
      payment_id: paymentId,
      obligation_id: obligation.obligation_id,
      allocated_amount: amount,
      created_at: now,
    };
  });

  await sequelize.getQueryInterface().bulkInsert('payment_allocations', allocationRows);

  for (const obligation of obligations) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'payment_obligations',
        { due_status: 'PAID', updated_at: now },
        { obligation_id: obligation.obligation_id },
      );
  }

  const bookingIds = new Set(obligations.map((o) => o.booking_id));
  for (const bookingId of bookingIds) {
    await maybeConfirmBookingAndNotify(bookingId);
  }
}

// BOOKING_CONFIRMATION (module 2.11, PRD §12.45) fires once every
// obligation for a booking is PAID — the natural "your booking is
// confirmed" moment. The Phase 1/2.4 schema never actually flipped
// bookings.booking_status to CONFIRMED anywhere (module 2.6's createMatch
// requires a CONFIRMED booking, so this was a real gap, not just a
// notification-plumbing one) — fixed here since it's the same condition.
// Reuses fetchBooking/getObligationsForBooking rather than a new join so
// the booking's own row is always the single source of truth for status.
// Never throws — a failure here must never fail the payment that already
// succeeded (mirrors notificationService.sendNotification's own contract).
async function maybeConfirmBookingAndNotify(bookingId: string) {
  try {
    await maybeConfirmBookingAndNotifyUnsafe(bookingId);
  } catch (error) {
    console.error(`[paymentService] Failed to confirm booking ${bookingId}:`, error);
  }
}

async function maybeConfirmBookingAndNotifyUnsafe(bookingId: string) {
  const booking = await fetchBooking(bookingId);
  if (!booking || booking.booking_status === 'CONFIRMED') return;

  const obligations = await getObligationsForBooking(bookingId);
  const fullyPaid = obligations.length > 0 && obligations.every((o) => o.due_status === 'PAID');
  if (!fullyPaid) return;

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'bookings',
      { booking_status: 'CONFIRMED', updated_at: new Date() },
      { booking_id: bookingId },
    );

  await sendNotification({
    userId: booking.booked_by,
    event: 'BOOKING_CONFIRMATION',
    params: { date: booking.booking_date, time: booking.start_time.slice(0, 5) },
    relatedEntityType: 'booking',
    relatedEntityId: bookingId,
  });
}

interface PaymentRow {
  payment_id: string;
  payer_id: string;
  amount: string;
  currency: string;
  payment_method: string;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  collected_by: string | null;
  cash_reference: string | null;
  payment_status: string;
  initiated_at: string;
  completed_at: string | null;
}

async function fetchPayment(paymentId: string): Promise<PaymentRow | null> {
  const [payment] = await sequelize.query<PaymentRow>(
    'SELECT * FROM payments WHERE payment_id = :paymentId',
    { type: QueryTypes.SELECT, replacements: { paymentId } },
  );
  return payment ?? null;
}

async function fetchPaymentByGatewayOrderId(gatewayOrderId: string): Promise<PaymentRow | null> {
  const [payment] = await sequelize.query<PaymentRow>(
    'SELECT * FROM payments WHERE gateway_order_id = :gatewayOrderId',
    { type: QueryTypes.SELECT, replacements: { gatewayOrderId } },
  );
  return payment ?? null;
}

// The full payment_status state machine transition driven by a verified
// Razorpay webhook event (this module's requirement 2). Idempotent: a
// duplicate `payment.captured` retry (Razorpay retries webhooks that don't
// 2xx quickly) is a no-op once the payment is already SUCCESS.
export async function confirmGatewayPayment(
  gatewayOrderId: string,
  gatewayPaymentId: string,
  eventType: 'payment.captured' | 'payment.failed',
  obligationIds: string[],
) {
  const payment = await fetchPaymentByGatewayOrderId(gatewayOrderId);
  if (!payment) throw new PaymentNotFoundError(gatewayOrderId);

  if (payment.payment_status !== 'PENDING') {
    return payment;
  }

  const now = new Date();

  if (eventType === 'payment.captured') {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'payments',
        { payment_status: 'SUCCESS', gateway_payment_id: gatewayPaymentId, completed_at: now },
        { payment_id: payment.payment_id },
      );
    const obligations = await fetchObligations(obligationIds);
    if (obligations.length > 0) {
      await allocatePaymentToObligations(payment.payment_id, obligations);
    }
  } else {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'payments',
        { payment_status: 'FAILED', gateway_payment_id: gatewayPaymentId, completed_at: now },
        { payment_id: payment.payment_id },
      );
  }

  return fetchPayment(payment.payment_id);
}

export async function listPaymentsForUser(userId: string): Promise<PaymentRow[]> {
  return sequelize.query<PaymentRow>(
    'SELECT * FROM payments WHERE payer_id = :userId OR collected_by = :userId ORDER BY initiated_at DESC',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
}

export async function listPaymentsForBooking(bookingId: string): Promise<PaymentRow[]> {
  return sequelize.query<PaymentRow>(
    `SELECT p.* FROM payments p
     JOIN payment_allocations pa ON pa.payment_id = p.payment_id
     JOIN payment_obligations po ON po.obligation_id = pa.obligation_id
     WHERE po.booking_id = :bookingId
     ORDER BY p.initiated_at DESC`,
    { type: QueryTypes.SELECT, replacements: { bookingId } },
  );
}

// ---- Cancellation & Refund policy (PRD §12.17 / §17.3) ----
// The PRD leaves exact thresholds "configurable by the turf owner/admin" —
// no such config table/UI exists yet (out of MVP scope), so this is the
// documented DEFAULT policy until an owner-configurable version replaces it:
//   >= 24h before the slot: full refund
//   >= 3h and < 24h before: 50% refund
//   < 3h before (or after): no refund
export function calculateRefundPercentage(hoursBeforeSlot: number): number {
  if (hoursBeforeSlot >= 24) return 1;
  if (hoursBeforeSlot >= 3) return 0.5;
  return 0;
}

export async function refundPaymentsForBooking(
  bookingId: string,
  cancelledAt: Date,
  initiatedBy: string,
) {
  const booking = await fetchBooking(bookingId);
  if (!booking) throw new BookingNotFoundError(bookingId);

  const slotStart = new Date(`${booking.booking_date}T${booking.start_time}`);
  const hoursBeforeSlot = (slotStart.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60);
  const refundPct = calculateRefundPercentage(hoursBeforeSlot);

  const payments = await sequelize.query<PaymentRow>(
    `SELECT DISTINCT p.* FROM payments p
     JOIN payment_allocations pa ON pa.payment_id = p.payment_id
     JOIN payment_obligations po ON po.obligation_id = pa.obligation_id
     WHERE po.booking_id = :bookingId AND p.payment_status = 'SUCCESS'`,
    { type: QueryTypes.SELECT, replacements: { bookingId } },
  );

  const results = [];
  for (const payment of payments) {
    const refundAmount = Number((Number(payment.amount) * refundPct).toFixed(2));
    const refundId = randomUUID();
    const now = new Date();

    if (refundAmount <= 0) {
      await sequelize.getQueryInterface().bulkInsert('refunds', [
        {
          refund_id: refundId,
          payment_id: payment.payment_id,
          refund_amount: 0,
          reason: `Booking cancelled ${hoursBeforeSlot.toFixed(1)}h before the slot — outside the refund window.`,
          refund_status: 'COMPLETED',
          gateway_refund_id: null,
          initiated_by: initiatedBy,
          created_at: now,
          completed_at: now,
        },
      ]);
      results.push({
        payment_id: payment.payment_id,
        refund_amount: 0,
        refund_status: 'COMPLETED',
      });
      continue;
    }

    // Refund method mirrors the original payment method where possible
    // (this module's requirement 5): a gateway payment is refunded via
    // Razorpay's API; a cash payment has no automated refund rail, so it's
    // recorded PENDING for the turf owner/staff to settle manually.
    let refundStatus: 'PENDING' | 'COMPLETED' | 'FAILED' = 'PENDING';
    let gatewayRefundId: string | null = null;

    if (payment.gateway === 'RAZORPAY' && payment.gateway_payment_id) {
      try {
        const refund = await refundGatewayPayment(payment.gateway_payment_id, refundAmount);
        if (refund) {
          refundStatus = 'COMPLETED';
          gatewayRefundId = refund.gateway_refund_id;
        }
      } catch {
        refundStatus = 'FAILED';
      }
    }

    await sequelize.getQueryInterface().bulkInsert('refunds', [
      {
        refund_id: refundId,
        payment_id: payment.payment_id,
        refund_amount: refundAmount,
        reason: `Booking cancelled ${hoursBeforeSlot.toFixed(1)}h before the slot — ${Math.round(refundPct * 100)}% refund per policy.`,
        refund_status: refundStatus,
        gateway_refund_id: gatewayRefundId,
        initiated_by: initiatedBy,
        created_at: now,
        completed_at: refundStatus === 'PENDING' ? null : now,
      },
    ]);

    if (refundAmount >= Number(payment.amount)) {
      await sequelize
        .getQueryInterface()
        .bulkUpdate('payments', { payment_status: 'REFUNDED' }, { payment_id: payment.payment_id });
    }

    results.push({
      payment_id: payment.payment_id,
      refund_amount: refundAmount,
      refund_status: refundStatus,
    });
  }

  return results;
}
