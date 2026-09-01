import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import { sequelize } from '../config/sequelize';
import { GatewayNotConfiguredError, InvalidWebhookSignatureError } from '../domain/errors';

export interface RazorpayConfig {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

export function getRazorpayConfig(): RazorpayConfig {
  return {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  };
}

export function createRazorpayClient() {
  const config = getRazorpayConfig();
  if (!config.keyId || !config.keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });
}

export interface RazorpayWebhookPayload {
  event: string;
  payment_id: string;
  [key: string]: unknown;
}

/**
 * Appends a raw Razorpay webhook payload to the append-only `payment_events`
 * log (BFAM_dbData_v2_compact.md "payment_events — MVP"). This is a skeleton
 * per Tech Stack Doc §7.3: it only persists the raw event, it does not yet
 * drive any payment/booking state transitions.
 *
 * `payment_id` is required because payment_events.payment_id is a required
 * FK to payments.payment_id — callers (or the gateway payload itself) must
 * supply a payment_id that already exists in `payments`.
 */
export async function persistRazorpayWebhookEvent(payload: RazorpayWebhookPayload) {
  if (!payload || typeof payload.event !== 'string' || payload.event.length === 0) {
    throw new Error('Webhook payload missing "event" field');
  }
  if (typeof payload.payment_id !== 'string' || payload.payment_id.length === 0) {
    throw new Error('Webhook payload missing "payment_id" field');
  }

  const eventId = randomUUID();
  const receivedAt = new Date();

  await sequelize.getQueryInterface().bulkInsert('payment_events', [
    {
      event_id: eventId,
      payment_id: payload.payment_id,
      event_type: payload.event,
      raw_payload: JSON.stringify(payload),
      received_at: receivedAt,
    },
  ]);

  return { event_id: eventId, received_at: receivedAt };
}

// ---- Module 2.4: Payments ----

export interface CreatedRazorpayOrder {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

// Creates a real Razorpay order for `amountRupees` (converted to paise, as
// Razorpay's API requires). Used for both the "UPI" and "Payment Gateway"
// selector options (PRD §12.16) — Razorpay Checkout presents UPI as one of
// its own payment tabs, so both selector options share this one order/
// webhook-confirmation flow; only the `payment_method` tag recorded against
// the resulting `payments` row differs (see services/paymentService.ts).
export async function createRazorpayOrder(
  amountRupees: number,
  receipt: string,
  notes?: Record<string, string>,
): Promise<CreatedRazorpayOrder> {
  const client = createRazorpayClient();
  const config = getRazorpayConfig();
  if (!client || !config.keyId) {
    throw new GatewayNotConfiguredError();
  }

  const order = await client.orders.create({
    amount: Math.round(amountRupees * 100),
    currency: 'INR',
    receipt,
    notes,
  });

  return {
    order_id: order.id,
    amount: amountRupees,
    currency: 'INR',
    key_id: config.keyId,
  };
}

// Razorpay signs webhooks with HMAC-SHA256 over the raw request body using
// the dashboard-configured webhook secret — verifying this is what stops
// anyone from POSTing a fake "payment succeeded" event at our webhook URL.
// See docs.razorpay.com/webhooks/validate-test. `timingSafeEqual` avoids a
// timing side-channel on the comparison; it throws on length mismatch, which
// we treat the same as "not equal".
export function verifyRazorpayWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
): void {
  const config = getRazorpayConfig();
  if (!config.webhookSecret) {
    throw new GatewayNotConfiguredError();
  }
  if (!signature) {
    throw new InvalidWebhookSignatureError();
  }

  const expected = createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signature, 'utf8');

  const isValid =
    expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
  if (!isValid) {
    throw new InvalidWebhookSignatureError();
  }
}

// Issues a real refund via Razorpay's Refunds API. Returns null (no gateway
// refund attempted) when the gateway isn't configured or the original
// payment wasn't a gateway payment — callers fall back to a manually-
// reconciled PENDING refund record in that case (see paymentService.ts).
export async function refundGatewayPayment(
  gatewayPaymentId: string,
  amountRupees: number,
): Promise<{ gateway_refund_id: string } | null> {
  const client = createRazorpayClient();
  if (!client) return null;

  const refund = await client.payments.refund(gatewayPaymentId, {
    amount: Math.round(amountRupees * 100),
  });
  return { gateway_refund_id: refund.id };
}
