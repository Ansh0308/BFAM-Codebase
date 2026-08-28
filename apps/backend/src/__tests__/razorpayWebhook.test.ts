// Exercises POST /payments/razorpay/webhook end-to-end, asserting the raw
// payload is appended to the payment_events store (append-only log per
// BFAM_dbData_v2_compact.md). Only the low-level `sequelize` driver call is
// faked, since no real MySQL is available in this test environment.

let paymentEvents: Array<Record<string, unknown>> = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'payment_events') {
            paymentEvents.push(...rows);
          }
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

describe('POST /payments/razorpay/webhook', () => {
  beforeEach(() => {
    paymentEvents = [];
  });

  it('persists the raw webhook payload as an append-only payment_events row', async () => {
    const payload = {
      event: 'payment.captured',
      payment_id: '11111111-1111-1111-1111-111111111111',
      extra: { amount: 240000 },
    };

    const response = await request(app).post('/payments/razorpay/webhook').send(payload);

    expect(response.status).toBe(202);
    expect(response.body.received).toBe(true);
    expect(response.body.event_id).toEqual(expect.any(String));
    expect(paymentEvents).toHaveLength(1);
    expect(paymentEvents[0].event_type).toBe('payment.captured');
    expect(paymentEvents[0].payment_id).toBe(payload.payment_id);
    expect(JSON.parse(paymentEvents[0].raw_payload as string)).toEqual(payload);
  });

  it('rejects a payload missing payment_id without writing an event', async () => {
    const response = await request(app)
      .post('/payments/razorpay/webhook')
      .send({ event: 'payment.captured' });

    expect(response.status).toBe(400);
    expect(paymentEvents).toHaveLength(0);
  });
});
