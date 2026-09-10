// API integration tests for backlog B-10: GET /players/:playerId, a
// public read-only profile view. Only `sequelize` is faked.

interface PlayerJoinRow {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  city: string | null;
  playing_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  experience_level: string | null;
  skill_rating: number;
  reliability_score: string;
  favorite_cricketer_name: string | null;
}

const VIEWER_USER = 'aaaaaaaa-0000-4000-8000-000000001301';
const TARGET_PLAYER_ID = 'bbbbbbbb-0000-4000-8000-000000001302';

let profileRow: PlayerJoinRow | null;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        if (sql.includes('FROM players p') && sql.includes('JOIN users u')) {
          return profileRow && profileRow.player_id === options.replacements?.playerId
            ? [profileRow]
            : [];
        }
        // Backlog B-9: getPublicProfile also fetches a follow_summary —
        // an empty/no-follow result is enough for these B-10-focused tests.
        if (sql.includes('COUNT(*) AS followersCount')) return [{ followersCount: 0 }];
        if (sql.includes('COUNT(*) AS followingCount')) return [{ followingCount: 0 }];
        if (sql.includes('FROM players WHERE user_id')) return [];
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

describe('GET /players/:playerId (backlog B-10)', () => {
  beforeEach(() => {
    profileRow = {
      player_id: TARGET_PLAYER_ID,
      bfam_id: 'BF1001',
      full_name: 'Asha Patel',
      profile_photo_url: 'https://example.com/asha.jpg',
      city: 'Rajkot',
      playing_role: 'BATTER',
      batting_style: 'RIGHT_HANDED',
      bowling_style: null,
      experience_level: 'INTERMEDIATE',
      skill_rating: 620,
      reliability_score: '95.00',
      favorite_cricketer_name: 'Virat Kohli',
    };
  });

  it('returns the public profile fields for a viewer other than the player themself', async () => {
    const token = await tokenFor(VIEWER_USER);
    const res = await request(app)
      .get(`/players/${TARGET_PLAYER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ...profileRow,
      follow_summary: { followers_count: 0, following_count: 0, is_following: false },
    });
  });

  it('never includes phone_number, email, or other private fields', async () => {
    const token = await tokenFor(VIEWER_USER);
    const res = await request(app)
      .get(`/players/${TARGET_PLAYER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.phone_number).toBeUndefined();
    expect(res.body.email).toBeUndefined();
    expect(res.body.date_of_birth).toBeUndefined();
    expect(res.body.gender).toBeUndefined();
    expect(res.body.coin_balance).toBeUndefined();
  });

  it('404s for a player that does not exist', async () => {
    const token = await tokenFor(VIEWER_USER);
    const res = await request(app)
      .get('/players/does-not-exist')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get(`/players/${TARGET_PLAYER_ID}`);
    expect(res.status).toBe(401);
  });
});
