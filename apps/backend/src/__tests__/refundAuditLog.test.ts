// Backlog G-24: refundPaymentsForBooking must write an audit_logs entry for
// every refund it issues, whether it's a real refund or the zero-amount
// "outside the refund window" case. Same in-memory-table mock pattern as
// paymentAllocation.test.ts.

const BOOKING_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const PLAYER_ID = 'cccccccc-0000-4000-8000-000000000003';
const ADMIN_ID = 'dddddddd-0000-4000-8000-000000000004';

interface PaymentRow {
  payment_id: string;
  amount: number;
  gateway: string;
  gateway_payment_id: string | null;
  payment_status: string;
}

let bookings: Array<{
  booking_id: string;
  booking_date: string;
  start_time: string;
}> = [];
let payments: PaymentRow[] = [];
let refunds: Array<Record<string, unknown>> = [];
let auditLogs: Array<Record<string, unknown>> = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM bookings WHERE booking_id')) {
          const b = bookings.find((x) => x.booking_id === r.bookingId);
          return b ? [b] : [];
        }
        if (sql.includes('FROM payments p') && sql.includes('payment_obligations')) {
          return payments.filter((p) => p.payment_status === 'SUCCESS');
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'refunds') refunds.push(...rows);
          if (table === 'audit_logs') auditLogs.push(...rows);
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'payments') {
            const p = payments.find((x) => x.payment_id === where.payment_id);
            if (p) Object.assign(p, values);
          }
        },
      }),
    },
  };
});

import { refundPaymentsForBooking } from '../services/paymentService';

describe('refundPaymentsForBooking audit logging (backlog G-24)', () => {
  beforeEach(() => {
    bookings = [{ booking_id: BOOKING_ID, booking_date: '2026-09-10', start_time: '18:00:00' }];
    payments = [];
    refunds = [];
    auditLogs = [];
  });

  it('writes a REFUND_ISSUED audit entry for a real refund', async () => {
    payments = [
      {
        payment_id: 'pay-1',
        amount: 1000,
        gateway: 'CASH',
        gateway_payment_id: null,
        payment_status: 'SUCCESS',
      },
    ];
    // Days before the slot -> full refund per calculateRefundPercentage,
    // regardless of local-timezone parsing of the un-suffixed booking date.
    const cancelledAt = new Date('2026-09-05T00:00:00Z');

    await refundPaymentsForBooking(BOOKING_ID, cancelledAt, PLAYER_ID, 'PLAYER');

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      action: 'REFUND_ISSUED',
      resource_type: 'payment',
      resource_id: 'pay-1',
      actor_user_id: PLAYER_ID,
      actor_role: 'PLAYER',
    });
    expect(JSON.parse(auditLogs[0].after_data as string)).toMatchObject({ refund_amount: 1000 });
  });

  it('writes a REFUND_ISSUED audit entry even for the zero-amount, outside-the-window case', async () => {
    payments = [
      {
        payment_id: 'pay-2',
        amount: 1000,
        gateway: 'CASH',
        gateway_payment_id: null,
        payment_status: 'SUCCESS',
      },
    ];
    // A day after the slot -> 0% refund per calculateRefundPercentage.
    const cancelledAt = new Date('2026-09-11T00:00:00Z');

    await refundPaymentsForBooking(BOOKING_ID, cancelledAt, ADMIN_ID, 'ADMIN');

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      action: 'REFUND_ISSUED',
      resource_id: 'pay-2',
      actor_user_id: ADMIN_ID,
      actor_role: 'ADMIN',
    });
    expect(JSON.parse(auditLogs[0].after_data as string)).toMatchObject({ refund_amount: 0 });
  });

  it('writes one audit entry per payment when a booking has multiple successful payments', async () => {
    payments = [
      {
        payment_id: 'pay-3',
        amount: 500,
        gateway: 'CASH',
        gateway_payment_id: null,
        payment_status: 'SUCCESS',
      },
      {
        payment_id: 'pay-4',
        amount: 500,
        gateway: 'CASH',
        gateway_payment_id: null,
        payment_status: 'SUCCESS',
      },
    ];
    const cancelledAt = new Date('2026-09-05T00:00:00Z');

    await refundPaymentsForBooking(BOOKING_ID, cancelledAt, PLAYER_ID, 'PLAYER');

    expect(auditLogs).toHaveLength(2);
    expect(auditLogs.map((l) => l.resource_id).sort()).toEqual(['pay-3', 'pay-4']);
  });
});
