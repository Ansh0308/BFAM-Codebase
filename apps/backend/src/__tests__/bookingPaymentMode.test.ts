// "Payment mode is asked twice with different names, and the booking shows the wrong one": the
// booking kept whatever was picked on the booking sheet, not how the player then paid. And a
// split booking's shares had no owner, so the payment screen could not find the booker's own
// share again after leaving it.

const bookingUpdates: { values: Record<string, unknown>; where: Record<string, unknown> }[] = [];
const obligationInserts: Record<string, unknown>[] = [];
let obligationCount = 1;

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string) => {
      if (sql.includes('SELECT * FROM bookings WHERE booking_id')) {
        return [
          {
            booking_id: 'booking-1',
            booked_by: 'user-1',
            booking_amount: '800.00',
            booking_status: 'CONFIRMED',
          },
        ];
      }
      if (sql.includes('COUNT(*) AS count FROM payment_obligations')) {
        return [{ count: obligationCount }];
      }
      if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
        return [{ player_id: 'player-booker' }];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
    getQueryInterface: () => ({
      bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
        if (table === 'payment_obligations') obligationInserts.push(...rows);
      },
      bulkUpdate: async (
        table: string,
        values: Record<string, unknown>,
        where: Record<string, unknown>,
      ) => {
        if (table === 'bookings') bookingUpdates.push({ values, where });
      },
    }),
  },
}));

import { createObligationsForBooking, syncBookingPaymentMode } from '../services/paymentService';

const obligation = { obligation_id: 'o1', booking_id: 'booking-1', player_id: null };

describe('booking payment mode follows how it was paid', () => {
  beforeEach(() => {
    bookingUpdates.length = 0;
    obligationInserts.length = 0;
    obligationCount = 1;
  });

  it('records cash when the booking was settled in cash', async () => {
    await syncBookingPaymentMode([obligation as never], 'CASH');
    expect(bookingUpdates).toEqual([
      { values: { payment_mode: 'CASH' }, where: { booking_id: 'booking-1' } },
    ]);
  });

  it('records GATEWAY for a Razorpay payment and UPI for UPI', async () => {
    await syncBookingPaymentMode([obligation as never], 'RAZORPAY');
    await syncBookingPaymentMode([obligation as never], 'UPI');
    expect(bookingUpdates.map((u) => u.values.payment_mode)).toEqual(['GATEWAY', 'UPI']);
  });

  it('leaves a split booking as a split payment', async () => {
    obligationCount = 3;
    await syncBookingPaymentMode([obligation as never], 'CASH');
    expect(bookingUpdates).toEqual([]);
  });
});

describe('splitting a booking', () => {
  beforeEach(() => {
    bookingUpdates.length = 0;
    obligationInserts.length = 0;
    obligationCount = 0;
  });

  it("names the booker on the first share and marks the booking 'split payment'", async () => {
    const shares = [
      { playerId: null, amount: 266.66 },
      { playerId: null, amount: 266.67 },
      { playerId: null, amount: 266.67 },
    ];
    await createObligationsForBooking('booking-1', 'user-1', shares);

    expect(obligationInserts.map((o) => o.player_id)).toEqual(['player-booker', null, null]);
    expect(bookingUpdates).toEqual([
      { values: { payment_mode: 'SPLIT_PAYMENT' }, where: { booking_id: 'booking-1' } },
    ]);
  });

  it('does not touch the payment mode for an ordinary single payment', async () => {
    await createObligationsForBooking('booking-1', 'user-1');
    expect(obligationInserts).toHaveLength(1);
    expect(bookingUpdates).toEqual([]);
  });
});
