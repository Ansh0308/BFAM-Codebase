// API integration tests for backlog B-3's chat routes: GET/POST
// /matches/:matchId/messages. Only `sequelize` and `realtime/io` are
// faked — the real routes/services run unmodified.

interface MatchRow {
  match_id: string;
  match_name: string | null;
  organizer_id: string;
  assigned_scorer_id: string | null;
}

const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000001001';
const ORGANIZER_USER = 'bbbbbbbb-0000-4000-8000-000000001002';
const OUTSIDER_USER = 'cccccccc-0000-4000-8000-000000001003';

let match: MatchRow;
const messages: Record<string, unknown>[] = [];

jest.mock('../realtime/io', () => ({
  getIo: () => null,
  matchRoom: (matchId: string) => `match:${matchId}`,
}));

jest.mock('../services/notificationService', () => ({
  sendNotificationToMany: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM matches WHERE match_id')) {
          return match.match_id === r.matchId ? [match] : [];
        }
        if (sql.includes('SELECT organizer_id, assigned_scorer_id FROM matches')) {
          return [
            { organizer_id: match.organizer_id, assigned_scorer_id: match.assigned_scorer_id },
          ];
        }
        if (sql.includes('mp.player_id FROM match_players')) return [];
        if (sql.includes('p.user_id FROM match_players')) return [];
        if (sql.includes('SELECT bfam_id, full_name FROM players WHERE user_id')) return [];
        if (sql.includes('FROM match_messages m')) {
          return messages.filter((m) => m.match_id === r.matchId);
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'match_messages') messages.push(...rows);
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

describe('GET/POST /matches/:matchId/messages (backlog B-3)', () => {
  beforeEach(() => {
    match = {
      match_id: MATCH_ID,
      match_name: 'Sunday Cricket',
      organizer_id: ORGANIZER_USER,
      assigned_scorer_id: null,
    };
    messages.length = 0;
  });

  it('lets the organizer post and then read back a message', async () => {
    const token = await tokenFor(ORGANIZER_USER);

    const post = await request(app)
      .post(`/matches/${MATCH_ID}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Kickoff at 6pm sharp.' });
    expect(post.status).toBe(201);

    const get = await request(app)
      .get(`/matches/${MATCH_ID}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.results).toHaveLength(1);
    expect(get.body.results[0].body).toBe('Kickoff at 6pm sharp.');
  });

  it('rejects a non-participant with 403', async () => {
    const token = await tokenFor(OUTSIDER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Can I join?' });
    expect(res.status).toBe(403);
  });

  it('rejects an empty message body with 400', async () => {
    const token = await tokenFor(ORGANIZER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '' });
    expect(res.status).toBe(400);
  });

  it('404s for a match that does not exist', async () => {
    const token = await tokenFor(ORGANIZER_USER);
    const res = await request(app)
      .get('/matches/does-not-exist/messages')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
