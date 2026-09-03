// API integration tests for module 2.12's staff-verification gate (PRD
// §32.14): a TURF_STAFF account must be blocked from Check-In and Payments
// actions until an owner approves their submitted document. Only
// `sequelize` is faked — the real routes/services run unmodified.

interface UserRow {
  user_id: string;
  role: string;
}
interface AssignmentRow {
  assignment_id: string;
  turf_id: string;
  staff_user_id: string;
  status: string;
  verification_status: string;
}
interface MatchRow {
  match_id: string;
  organizer_id: string;
  assigned_scorer_id: string | null;
}
interface MatchPlayerRow {
  match_player_id: string;
  match_id: string;
  player_id: string;
  invitation_status: string;
  attendance_status: string;
  checked_in_at: Date | null;
}
interface ObligationRow {
  obligation_id: string;
  booking_id: string;
  player_id: string | null;
  amount_due: number;
  due_status: string;
}
interface BookingRow {
  booking_id: string;
  turf_id: string;
  booked_by: string;
  booking_date: string;
  start_time: string;
  booking_status: string;
}

const OWNER_USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const STAFF_USER = 'bbbbbbbb-0000-4000-8000-000000000002';
const ORGANIZER_USER = 'cccccccc-0000-4000-8000-000000000003';
const PLAYER_USER = 'dddddddd-0000-4000-8000-000000000004';
const TURF_ID = 'eeeeeeee-0000-4000-8000-000000000005';
const MATCH_ID = 'ffffffff-0000-4000-8000-000000000006';
const MATCH_PLAYER_ID = '11111111-0000-4000-8000-000000000007';
const OBLIGATION_ID = '22222222-0000-4000-8000-000000000008';
const BOOKING_ID = '33333333-0000-4000-8000-000000000009';
const ASSIGNMENT_ID = '44444444-0000-4000-8000-00000000000a';

const users: UserRow[] = [
  { user_id: OWNER_USER, role: 'TURF_OWNER' },
  { user_id: STAFF_USER, role: 'TURF_STAFF' },
  { user_id: ORGANIZER_USER, role: 'PLAYER' },
  { user_id: PLAYER_USER, role: 'PLAYER' },
];
let assignments: AssignmentRow[] = [
  {
    assignment_id: ASSIGNMENT_ID,
    turf_id: TURF_ID,
    staff_user_id: STAFF_USER,
    status: 'ACTIVE',
    verification_status: 'PENDING',
  },
];
const matches: MatchRow[] = [
  { match_id: MATCH_ID, organizer_id: ORGANIZER_USER, assigned_scorer_id: STAFF_USER },
];
let matchPlayers: MatchPlayerRow[] = [
  {
    match_player_id: MATCH_PLAYER_ID,
    match_id: MATCH_ID,
    player_id: PLAYER_USER,
    invitation_status: 'CONFIRMED',
    attendance_status: 'PENDING',
    checked_in_at: null,
  },
];
let obligations: ObligationRow[] = [
  {
    obligation_id: OBLIGATION_ID,
    booking_id: BOOKING_ID,
    player_id: null,
    amount_due: 500,
    due_status: 'PENDING',
  },
];
const bookings: BookingRow[] = [
  {
    booking_id: BOOKING_ID,
    turf_id: TURF_ID,
    booked_by: ORGANIZER_USER,
    booking_date: '2099-01-01',
    start_time: '18:00:00',
    booking_status: 'PENDING',
  },
];
let payments: Array<Record<string, unknown>> = [];
let allocations: Array<Record<string, unknown>> = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('SELECT role FROM users WHERE user_id')) {
          const u = users.find((x) => x.user_id === (r.actorUserId ?? r.collectedBy));
          return u ? [{ role: u.role }] : [];
        }
        if (
          sql.includes('FROM turf_staff_assignments') &&
          sql.includes("status = 'ACTIVE'") &&
          !sql.includes('JOIN')
        ) {
          return assignments
            .filter((a) => a.staff_user_id === r.staffUserId && a.status === 'ACTIVE')
            .map((a) => ({ verification_status: a.verification_status }));
        }
        if (sql.includes('FROM matches WHERE match_id')) {
          const m = matches.find((x) => x.match_id === r.matchId);
          return m ? [m] : [];
        }
        if (sql.includes('FROM match_players WHERE match_id = :matchId AND player_id')) {
          const mp = matchPlayers.find(
            (x) => x.match_id === r.matchId && x.player_id === r.playerId,
          );
          return mp ? [mp] : [];
        }
        if (sql.includes('FROM payment_obligations WHERE obligation_id IN')) {
          const ids = r.ids as string[];
          return obligations.filter((o) => ids.includes(o.obligation_id));
        }
        if (sql.includes('FROM bookings WHERE booking_id')) {
          const b = bookings.find((x) => x.booking_id === r.bookingId);
          return b ? [b] : [];
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
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'payments') payments.push(...rows);
          if (table === 'payment_allocations') allocations.push(...rows);
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'match_players') {
            const mp = matchPlayers.find((x) => x.match_player_id === where.match_player_id);
            if (mp) Object.assign(mp, values);
          }
          if (table === 'payment_obligations') {
            const o = obligations.find((x) => x.obligation_id === where.obligation_id);
            if (o) Object.assign(o, values);
          }
        },
        bulkDelete: async () => {},
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string, role: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('Staff verification gate (module 2.12, PRD §32.14)', () => {
  beforeEach(() => {
    assignments = [
      {
        assignment_id: ASSIGNMENT_ID,
        turf_id: TURF_ID,
        staff_user_id: STAFF_USER,
        status: 'ACTIVE',
        verification_status: 'PENDING',
      },
    ];
    matchPlayers = [
      {
        match_player_id: MATCH_PLAYER_ID,
        match_id: MATCH_ID,
        player_id: PLAYER_USER,
        invitation_status: 'CONFIRMED',
        attendance_status: 'PENDING',
        checked_in_at: null,
      },
    ];
    obligations = [
      {
        obligation_id: OBLIGATION_ID,
        booking_id: BOOKING_ID,
        player_id: null,
        amount_due: 500,
        due_status: 'PENDING',
      },
    ];
    payments = [];
    allocations = [];
  });

  describe('Check-In', () => {
    it('blocks an unverified (PENDING) staff member from checking a player in', async () => {
      const token = await tokenFor(STAFF_USER, 'TURF_STAFF');
      const res = await request(app)
        .post(`/matches/${MATCH_ID}/attendance/${PLAYER_USER}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ attendance_status: 'CHECKED_IN' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/pending verification/i);
      expect(matchPlayers[0].attendance_status).toBe('PENDING');
    });

    it('blocks a REJECTED staff member the same way', async () => {
      assignments[0].verification_status = 'REJECTED';
      const token = await tokenFor(STAFF_USER, 'TURF_STAFF');
      const res = await request(app)
        .post(`/matches/${MATCH_ID}/attendance/${PLAYER_USER}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ attendance_status: 'CHECKED_IN' });

      expect(res.status).toBe(403);
    });

    it('allows an APPROVED staff member to check a player in', async () => {
      assignments[0].verification_status = 'APPROVED';
      const token = await tokenFor(STAFF_USER, 'TURF_STAFF');
      const res = await request(app)
        .post(`/matches/${MATCH_ID}/attendance/${PLAYER_USER}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ attendance_status: 'CHECKED_IN' });

      expect(res.status).toBe(204);
      expect(matchPlayers[0].attendance_status).toBe('CHECKED_IN');
    });

    it('never gates the organizer (a PLAYER), only staff', async () => {
      const token = await tokenFor(ORGANIZER_USER, 'PLAYER');
      const res = await request(app)
        .post(`/matches/${MATCH_ID}/attendance/${PLAYER_USER}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ attendance_status: 'CHECKED_IN' });

      expect(res.status).toBe(204);
    });
  });

  describe('Payments', () => {
    it('blocks an unverified staff member from collecting a cash payment', async () => {
      const token = await tokenFor(STAFF_USER, 'TURF_STAFF');
      const res = await request(app)
        .post('/payments/cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ obligation_ids: [OBLIGATION_ID] });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/pending verification/i);
      expect(payments).toHaveLength(0);
    });

    it('allows an APPROVED staff member to collect a cash payment', async () => {
      assignments[0].verification_status = 'APPROVED';
      const token = await tokenFor(STAFF_USER, 'TURF_STAFF');
      const res = await request(app)
        .post('/payments/cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ obligation_ids: [OBLIGATION_ID] });

      expect(res.status).toBe(201);
      expect(payments).toHaveLength(1);
    });

    it('never gates a PLAYER captain collecting cash from teammates', async () => {
      const token = await tokenFor(ORGANIZER_USER, 'PLAYER');
      const res = await request(app)
        .post('/payments/cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ obligation_ids: [OBLIGATION_ID] });

      expect(res.status).toBe(201);
    });
  });
});
