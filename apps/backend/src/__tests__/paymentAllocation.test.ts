// Unit tests for module 2.4's payment allocation math: payment_obligations
// -> payments -> payment_allocations. Fakes `sequelize` with small in-memory
// tables (same pattern as turfs.test.ts / bookings.test.ts) so the real
// service logic runs unmodified.

const BOOKING_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const BOOKER_ID = 'cccccccc-0000-4000-8000-000000000003';
const PLAYER_A = 'dddddddd-0000-4000-8000-000000000004';
const PLAYER_B = 'eeeeeeee-0000-4000-8000-000000000005';

interface ObligationRow {
  obligation_id: string;
  booking_id: string;
  player_id: string | null;
  amount_due: number;
  due_status: string;
  created_at: Date;
  updated_at: Date;
}
interface PaymentRow {
  payment_id: string;
  payer_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  collected_by: string | null;
  cash_reference: string | null;
  payment_status: string;
  initiated_at: Date;
  completed_at: Date | null;
}
interface AllocationRow {
  allocation_id: string;
  payment_id: string;
  obligation_id: string;
  allocated_amount: number;
  created_at: Date;
}

let bookings: Array<{
  booking_id: string;
  booked_by: string;
  booking_amount: number;
  booking_date: string;
  start_time: string;
}> = [];
let obligations: ObligationRow[] = [];
let payments: PaymentRow[] = [];
let allocations: AllocationRow[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('FROM bookings WHERE booking_id')) {
          const b = bookings.find((x) => x.booking_id === r.bookingId);
          return b ? [b] : [];
        }
        // module 2.12's staff-verification gate in recordCashPayment — every
        // collector in this test is the PLAYER booker, never staff, so the
        // gate is always a no-op here.
        if (sql.includes('SELECT role FROM users WHERE user_id')) {
          return [{ role: 'PLAYER' }];
        }
        if (sql.includes('SELECT COUNT(*) AS count FROM payment_obligations')) {
          return [{ count: obligations.filter((o) => o.booking_id === r.bookingId).length }];
        }
        if (sql.includes('FROM payment_obligations WHERE obligation_id IN')) {
          const ids = r.ids as string[];
          return obligations.filter((o) => ids.includes(o.obligation_id));
        }
        if (sql.includes('FROM payment_obligations WHERE booking_id')) {
          return obligations.filter((o) => o.booking_id === r.bookingId);
        }
        if (sql.includes('FROM payments WHERE payment_id')) {
          const p = payments.find((x) => x.payment_id === r.paymentId);
          return p ? [p] : [];
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'payment_obligations')
            obligations.push(...(rows as unknown as ObligationRow[]));
          if (table === 'payments') payments.push(...(rows as unknown as PaymentRow[]));
          if (table === 'payment_allocations')
            allocations.push(...(rows as unknown as AllocationRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'payment_obligations') {
            const idx = obligations.findIndex((o) => o.obligation_id === where.obligation_id);
            if (idx >= 0) obligations[idx] = { ...obligations[idx], ...values } as ObligationRow;
          }
          if (table === 'payments') {
            const idx = payments.findIndex((p) => p.payment_id === where.payment_id);
            if (idx >= 0) payments[idx] = { ...payments[idx], ...values } as PaymentRow;
          }
        },
      }),
    },
  };
});

import { createObligationsForBooking, recordCashPayment } from '../services/paymentService';
import {
  AllocationExceedsObligationError,
  InvalidPaymentStateError,
  ObligationsAlreadyExistError,
} from '../domain/errors';

describe('Payment allocation math (module 2.4)', () => {
  beforeEach(() => {
    bookings = [
      {
        booking_id: BOOKING_ID,
        booked_by: BOOKER_ID,
        booking_amount: 1000,
        booking_date: '2026-09-20',
        start_time: '19:00:00',
      },
    ];
    obligations = [];
    payments = [];
    allocations = [];
  });

  describe('createObligationsForBooking', () => {
    it('defaults to a single full-amount obligation when no shares are given', async () => {
      const rows = await createObligationsForBooking(BOOKING_ID, BOOKER_ID);
      expect(rows).toHaveLength(1);
      expect(rows[0].player_id).toBeNull();
      expect(rows[0].amount_due).toBe(1000);
    });

    it('splits into N obligations that sum exactly to the booking amount (split payment)', async () => {
      const rows = await createObligationsForBooking(BOOKING_ID, BOOKER_ID, [
        { playerId: PLAYER_A, amount: 500 },
        { playerId: PLAYER_B, amount: 500 },
      ]);
      expect(rows).toHaveLength(2);
      const total = rows.reduce((sum, r) => sum + r.amount_due, 0);
      expect(total).toBe(1000);
    });

    it('rejects shares that do not sum to the booking amount', async () => {
      await expect(
        createObligationsForBooking(BOOKING_ID, BOOKER_ID, [
          { playerId: PLAYER_A, amount: 400 },
          { playerId: PLAYER_B, amount: 400 },
        ]),
      ).rejects.toBeInstanceOf(AllocationExceedsObligationError);
    });

    it('refuses to create obligations twice for the same booking', async () => {
      await createObligationsForBooking(BOOKING_ID, BOOKER_ID);
      await expect(createObligationsForBooking(BOOKING_ID, BOOKER_ID)).rejects.toBeInstanceOf(
        ObligationsAlreadyExistError,
      );
    });
  });

  describe('recordCashPayment / allocatePaymentToObligations', () => {
    it('allocates a payment across the settled obligations, summing correctly', async () => {
      const created = await createObligationsForBooking(BOOKING_ID, BOOKER_ID, [
        { playerId: PLAYER_A, amount: 500 },
        { playerId: PLAYER_B, amount: 500 },
      ]);

      const payment = await recordCashPayment(
        created.map((o) => o.obligation_id),
        BOOKER_ID,
        BOOKER_ID,
        'CASH-0001',
      );

      expect(payment?.amount).toBe(1000);
      expect(allocations).toHaveLength(2);
      const allocatedSum = allocations.reduce((sum, a) => sum + a.allocated_amount, 0);
      expect(allocatedSum).toBe(1000);
      expect(obligations.every((o) => o.due_status === 'PAID')).toBe(true);
    });

    it('handles partial collection — one obligation paid now, the other later, no double-allocation', async () => {
      const created = await createObligationsForBooking(BOOKING_ID, BOOKER_ID, [
        { playerId: PLAYER_A, amount: 500 },
        { playerId: PLAYER_B, amount: 500 },
      ]);

      await recordCashPayment([created[0].obligation_id], PLAYER_A, PLAYER_A, 'A-PAID');

      expect(
        obligations.find((o) => o.obligation_id === created[0].obligation_id)?.due_status,
      ).toBe('PAID');
      expect(
        obligations.find((o) => o.obligation_id === created[1].obligation_id)?.due_status,
      ).toBe('PENDING');
      expect(allocations).toHaveLength(1);
      expect(payments).toHaveLength(1);

      await recordCashPayment([created[1].obligation_id], PLAYER_B, PLAYER_B, 'B-PAID');

      expect(obligations.every((o) => o.due_status === 'PAID')).toBe(true);
      expect(allocations).toHaveLength(2);
      expect(payments).toHaveLength(2);
      // No double-allocation: each obligation was allocated exactly once,
      // for exactly its own amount_due.
      for (const obligation of created) {
        const matches = allocations.filter((a) => a.obligation_id === obligation.obligation_id);
        expect(matches).toHaveLength(1);
        expect(matches[0].allocated_amount).toBe(obligation.amount_due);
      }
    });

    it('refuses to settle an obligation that has already been paid (no double-allocation)', async () => {
      const created = await createObligationsForBooking(BOOKING_ID, BOOKER_ID);
      await recordCashPayment([created[0].obligation_id], BOOKER_ID, BOOKER_ID, undefined);

      await expect(
        recordCashPayment([created[0].obligation_id], BOOKER_ID, BOOKER_ID, undefined),
      ).rejects.toBeInstanceOf(InvalidPaymentStateError);

      // Still only ever allocated once.
      expect(allocations).toHaveLength(1);
      expect(payments).toHaveLength(1);
    });
  });
});
