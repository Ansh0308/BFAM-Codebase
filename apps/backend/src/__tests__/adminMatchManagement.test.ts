// Exercises GET /admin/matches and POST /admin/matches/:matchId/force-cancel
// (backlog E-2). Only `sequelize` is faked — the real routes/services run
// unmodified.

interface MatchRow {
  match_id: string;
  match_name: string | null;
  match_type: string;
  match_status: string;
  visibility: string;
  scheduled_start_time: Date;
  organizer_id: string;
  booking_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const ADMIN_ID = 'aaaaaaaa-0000-4000-8000-001201';
const ORGANIZER_ID = 'bbbbbbbb-0000-4000-8000-001202';
const TURF_ID = 'cccccccc-0000-4000-8000-001203';
const BOOKING_ID = 'dddddddd-0000-4000-8000-001204';

let matches: MatchRow[];
let users: Array<{ user_id: string; phone_number: string }>;
let players: Array<{ user_id: string; full_name: string | null }>;
let bookings: Array<{ booking_id: string; turf_id: string }>;
let turfs: Array<{ turf_id: string; turf_name: string }>;
let auditLogs: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM matches m') && sql.includes('JOIN users u')) {
          return matches.map((m) => {
            const user = users.find((u) => u.user_id === m.organizer_id);
            const player = players.find((p) => p.user_id === m.organizer_id);
            const booking = bookings.find((b) => b.booking_id === m.booking_id);
            const turf = booking ? turfs.find((t) => t.turf_id === booking.turf_id) : undefined;
            return {
              ...m,
              organizer_name: player?.full_name ?? null,
              organizer_phone: user?.phone_number ?? '',
              turf_name: turf?.turf_name ?? null,
            };
          });
        }
        if (sql.includes('SELECT match_status FROM matches WHERE match_id')) {
          const m = matches.find((x) => x.match_id === r.matchId);
          return m ? [{ match_status: m.match_status }] : [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'matches') {
            const m = matches.find((x) => x.match_id === where.match_id);
            if (m) Object.assign(m, values);
          }
        },
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'audit_logs') auditLogs.push(...rows);
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(role: 'ADMIN' | 'PLAYER', userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('Admin Match Management (backlog E-2)', () => {
  beforeEach(() => {
    matches = [
      {
        match_id: 'match-1',
        match_name: 'Sunday Showdown',
        match_type: 'FRIENDLY',
        match_status: 'OPEN',
        visibility: 'PUBLIC',
        scheduled_start_time: new Date('2026-09-28T12:00:00Z'),
        organizer_id: ORGANIZER_ID,
        booking_id: BOOKING_ID,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    users = [{ user_id: ORGANIZER_ID, phone_number: '+919876500001' }];
    players = [{ user_id: ORGANIZER_ID, full_name: 'Vikram Organizer' }];
    bookings = [{ booking_id: BOOKING_ID, turf_id: TURF_ID }];
    turfs = [{ turf_id: TURF_ID, turf_name: 'Green Park Box Cricket' }];
    auditLogs = [];
  });

  describe('GET /admin/matches', () => {
    it('lists every match across every organizer, with organizer and turf attached', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app).get('/admin/matches').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0]).toMatchObject({
        match_name: 'Sunday Showdown',
        organizer_name: 'Vikram Organizer',
        turf_name: 'Green Park Box Cricket',
      });
    });

    it('rejects a non-admin caller', async () => {
      const token = await tokenFor('PLAYER', ORGANIZER_ID);
      const res = await request(app).get('/admin/matches').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /admin/matches/:matchId/force-cancel', () => {
    it('force-cancels a match and writes an audit log entry', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .post('/admin/matches/match-1/force-cancel')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.match_status).toBe('CANCELLED');
      expect(matches[0].match_status).toBe('CANCELLED');
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toMatchObject({
        action: 'MATCH_FORCE_CANCELLED',
        resource_id: 'match-1',
        actor_user_id: ADMIN_ID,
        actor_role: 'ADMIN',
      });
    });

    it('returns 404 for an unknown match', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .post('/admin/matches/not-a-real-match/force-cancel')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('rejects force-cancelling an already-completed match', async () => {
      matches[0].match_status = 'COMPLETED';
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .post('/admin/matches/match-1/force-cancel')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
      expect(matches[0].match_status).toBe('COMPLETED');
    });

    it('rejects force-cancelling an already-cancelled match', async () => {
      matches[0].match_status = 'CANCELLED';
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .post('/admin/matches/match-1/force-cancel')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
    });

    it('rejects a non-admin caller', async () => {
      const token = await tokenFor('PLAYER', ORGANIZER_ID);
      const res = await request(app)
        .post('/admin/matches/match-1/force-cancel')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(matches[0].match_status).toBe('OPEN');
    });
  });
});
