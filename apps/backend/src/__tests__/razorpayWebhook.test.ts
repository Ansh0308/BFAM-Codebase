// Exercises POST /payments/razorpay/webhook end-to-end (module 2.4):
// signature verification, the payment_status state machine transition, and
// allocation of a captured payment across the obligations named in the
// order's `notes` (see services/paymentService.ts). Only `sequelize` is
// faked — signature verification and the crypto involved are real.

import { createHmac } from 'crypto';

const WEBHOOK_SECRET = 'test_webhook_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

interface PaymentRow {
  payment_id: string;
  payer_id: string;
  amount: number;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  payment_status: string;
  completed_at: Date | null;
}
interface ObligationRow {
  obligation_id: string;
  booking_id: string;
  amount_due: number;
  due_status: string;
}
interface AllocationRow {
  allocation_id: string;
  payment_id: string;
  obligation_id: string;
  allocated_amount: number;
}

let payments: PaymentRow[] = [];
let obligations: ObligationRow[] = [];
let allocations: AllocationRow[] = [];
let paymentEvents: Array<Record<string, unknown>> = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM payments WHERE gateway_order_id')) {
          const p = payments.find((x) => x.gateway_order_id === r.gatewayOrderId);
          return p ? [p] : [];
        }
        if (sql.includes('FROM payments WHERE payment_id')) {
          const p = payments.find((x) => x.payment_id === r.paymentId);
          return p ? [p] : [];
        }
        if (sql.includes('FROM payment_obligations WHERE obligation_id IN')) {
          const ids = r.ids as string[];
          return obligations.filter((o) => ids.includes(o.obligation_id));
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'payment_allocations')
            allocations.push(...(rows as unknown as AllocationRow[]));
          if (table === 'payment_events') paymentEvents.push(...rows);
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'payments') {
            const idx = payments.findIndex((p) => p.payment_id === where.payment_id);
            if (idx >= 0) payments[idx] = { ...payments[idx], ...values } as PaymentRow;
          }
          if (table === 'payment_obligations') {
            const idx = obligations.findIndex((o) => o.obligation_id === where.obligation_id);
            if (idx >= 0) obligations[idx] = { ...obligations[idx], ...values } as ObligationRow;
          }
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

const PAYMENT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const OBLIGATION_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const ORDER_ID = 'order_test123';
const GATEWAY_PAYMENT_ID = 'pay_test456';

function sign(body: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function capturedPayload(overrides: Record<string, unknown> = {}) {
  return {
    entity: 'event',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: GATEWAY_PAYMENT_ID,
          order_id: ORDER_ID,
          amount: 100000,
          status: 'captured',
          method: 'upi',
          notes: { bfam_payment_id: PAYMENT_ID, obligation_ids: JSON.stringify([OBLIGATION_ID]) },
        },
      },
    },
    ...overrides,
  };
}

describe('POST /payments/razorpay/webhook (module 2.4)', () => {
  beforeEach(() => {
    payments = [
      {
        payment_id: PAYMENT_ID,
        payer_id: 'payer-1',
        amount: 1000,
        gateway_order_id: ORDER_ID,
        gateway_payment_id: null,
        payment_status: 'PENDING',
        completed_at: null,
      },
    ];
    obligations = [
      {
        obligation_id: OBLIGATION_ID,
        booking_id: 'booking-1',
        amount_due: 1000,
        due_status: 'PENDING',
      },
    ];
    allocations = [];
    paymentEvents = [];
  });

  it('rejects a webhook with an invalid signature, without touching any state', async () => {
    const body = JSON.stringify(capturedPayload());
    const res = await request(app)
      .post('/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'not-the-real-signature')
      .send(body);

    expect(res.status).toBe(400);
    expect(payments[0].payment_status).toBe('PENDING');
    expect(allocations).toHaveLength(0);
  });

  it('rejects a webhook with no signature header at all', async () => {
    const body = JSON.stringify(capturedPayload());
    const res = await request(app)
      .post('/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(400);
  });

  it('transitions PENDING -> SUCCESS on a verified payment.captured event and allocates the obligation', async () => {
    const body = JSON.stringify(capturedPayload());
    const res = await request(app)
      .post('/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);

    expect(res.status).toBe(202);
    expect(payments[0].payment_status).toBe('SUCCESS');
    expect(payments[0].gateway_payment_id).toBe(GATEWAY_PAYMENT_ID);
    expect(allocations).toHaveLength(1);
    expect(allocations[0].allocated_amount).toBe(1000);
    expect(obligations[0].due_status).toBe('PAID');
    expect(paymentEvents).toHaveLength(1);
    expect(paymentEvents[0].payment_id).toBe(PAYMENT_ID);
  });

  it('transitions PENDING -> FAILED on a verified payment.failed event, without allocating anything', async () => {
    const body = JSON.stringify(capturedPayload({ event: 'payment.failed' }));
    const res = await request(app)
      .post('/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);

    expect(res.status).toBe(202);
    expect(payments[0].payment_status).toBe('FAILED');
    expect(allocations).toHaveLength(0);
    expect(obligations[0].due_status).toBe('PENDING');
  });

  it('is idempotent: a duplicate payment.captured retry does not double-allocate', async () => {
    const body = JSON.stringify(capturedPayload());
    const signature = sign(body);

    await request(app)
      .post('/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(body);

    const second = await request(app)
      .post('/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(body);

    expect(second.status).toBe(202);
    expect(allocations).toHaveLength(1);
    expect(payments[0].payment_status).toBe('SUCCESS');
  });

  it('acknowledges (but ignores) a webhook for an order it does not recognize', async () => {
    const body = JSON.stringify(
      capturedPayload({
        payload: {
          payment: { entity: { id: 'pay_unknown', order_id: 'order_unknown', notes: {} } },
        },
      }),
    );
    const res = await request(app)
      .post('/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);

    expect(res.status).toBe(202);
    expect(res.body.ignored).toBe(true);
  });
});
