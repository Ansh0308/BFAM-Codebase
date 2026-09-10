// API integration tests for backlog A-8: choosing, before scoring starts,
// whether extras count toward the official score. Only `sequelize` is
// faked — the real route/service runs unmodified.

interface MatchRow {
  match_id: string;
  organizer_id: string;
  assigned_scorer_id: string | null;
  scoring_mode: string;
  match_status: string;
  extras_count_toward_score: boolean;
}
interface InningsRow {
  innings_id: string;
  match_id: string;
}

const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000000101';
const ORGANIZER_USER = 'bbbbbbbb-0000-4000-8000-000000000102';
const OUTSIDER_USER = 'cccccccc-0000-4000-8000-000000000103';

let matches: MatchRow[] = [];
let innings: InningsRow[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM matches WHERE match_id')) {
          const m = matches.find((x) => x.match_id === r.matchId);
          return m ? [m] : [];
        }
        if (sql.includes('SELECT innings_id FROM innings WHERE match_id')) {
          return innings.filter((i) => i.match_id === r.matchId);
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'matches') {
            const row = matches.find((m) => m.match_id === where.match_id);
            if (row) Object.assign(row, values);
          }
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('POST /matches/:matchId/extras-setting (backlog A-8)', () => {
  beforeEach(() => {
    matches = [
      {
        match_id: MATCH_ID,
        organizer_id: ORGANIZER_USER,
        assigned_scorer_id: null,
        scoring_mode: 'PLAYER_MANAGED',
        match_status: 'SCHEDULED',
        extras_count_toward_score: true,
      },
    ];
    innings = [];
  });

  it('lets the organizer turn extras off before any innings has started', async () => {
    const token = await tokenFor(ORGANIZER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/extras-setting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ extras_count_toward_score: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ extras_count_toward_score: false });
    expect(matches[0].extras_count_toward_score).toBe(false);
  });

  it('rejects changing the setting once an innings already exists', async () => {
    innings = [{ innings_id: 'innings-1', match_id: MATCH_ID }];
    const token = await tokenFor(ORGANIZER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/extras-setting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ extras_count_toward_score: false });

    expect(res.status).toBe(409);
    expect(matches[0].extras_count_toward_score).toBe(true);
  });

  it('rejects a non-organizer, non-scorer caller', async () => {
    const token = await tokenFor(OUTSIDER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/extras-setting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ extras_count_toward_score: false });

    expect(res.status).toBe(403);
    expect(matches[0].extras_count_toward_score).toBe(true);
  });

  it('rejects a non-boolean payload', async () => {
    const token = await tokenFor(ORGANIZER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/extras-setting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ extras_count_toward_score: 'nope' });

    expect(res.status).toBe(400);
  });
});
