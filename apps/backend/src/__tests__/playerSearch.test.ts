// API integration tests for backlog B-12: GET /players/search, a name/
// BFAM-ID search backing the Home top nav's player search. Only
// `sequelize` is faked.

interface PlayerRow {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  city: string | null;
  playing_role: string | null;
}

let players: PlayerRow[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        if (sql.includes('FROM players p') && sql.includes('JOIN users u')) {
          const q = ((options.replacements?.q as string) ?? '').replace(/%/g, '').toLowerCase();
          return players
            .filter(
              (p) => p.full_name?.toLowerCase().includes(q) || p.bfam_id.toLowerCase().includes(q),
            )
            .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('GET /players/search (backlog B-12)', () => {
  beforeEach(() => {
    players = [
      {
        player_id: 'p-rohan',
        bfam_id: 'BF1001',
        full_name: 'Rohan Mehta',
        profile_photo_url: null,
        city: 'Rajkot',
        playing_role: 'BATTER',
      },
      {
        player_id: 'p-rohit',
        bfam_id: 'BF1002',
        full_name: 'Rohit Shah',
        profile_photo_url: null,
        city: 'Ahmedabad',
        playing_role: 'BOWLER',
      },
      {
        player_id: 'p-aditya',
        bfam_id: 'BF2001',
        full_name: 'Aditya Rathod',
        profile_photo_url: null,
        city: 'Rajkot',
        playing_role: null,
      },
    ];
  });

  it('matches by a substring of the full name, case-insensitively', async () => {
    const token = await tokenFor('viewer-1');
    const res = await request(app)
      .get('/players/search?q=roh')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results.map((r: PlayerRow) => r.bfam_id)).toEqual(['BF1001', 'BF1002']);
  });

  it('matches by BFAM ID', async () => {
    const token = await tokenFor('viewer-1');
    const res = await request(app)
      .get('/players/search?q=BF2001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].full_name).toBe('Aditya Rathod');
  });

  it('returns an empty list for a blank query, without dumping the whole table', async () => {
    const token = await tokenFor('viewer-1');
    const res = await request(app).get('/players/search').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/players/search?q=roh');
    expect(res.status).toBe(401);
  });
});
