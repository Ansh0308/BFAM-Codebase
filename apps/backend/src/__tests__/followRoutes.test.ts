// API integration tests for backlog B-9's follow/unfollow routes. Only
// `sequelize` is faked — the real route/service runs unmodified.

const FOLLOWER_USER = 'aaaaaaaa-0000-4000-8000-000000001501';
const FOLLOWER_PLAYER = 'bbbbbbbb-0000-4000-8000-000000001502';
const TARGET_PLAYER = 'cccccccc-0000-4000-8000-000000001503';

let follows: { follower_player_id: string; followed_player_id: string }[];

jest.mock('../services/notificationService', () => ({
  sendNotificationToMany: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          return r.userId === FOLLOWER_USER ? [{ player_id: FOLLOWER_PLAYER }] : [];
        }
        if (sql.includes('SELECT player_id FROM players WHERE player_id')) {
          return r.playerId === TARGET_PLAYER ? [{ player_id: TARGET_PLAYER }] : [];
        }
        if (sql.includes('SELECT follow_id FROM player_follows')) {
          const exists = follows.some(
            (f) =>
              f.follower_player_id === (r.followerId ?? r.viewerPlayerId) &&
              f.followed_player_id === (r.targetId ?? r.playerId),
          );
          return exists ? [{ follow_id: 'f1' }] : [];
        }
        if (sql.includes('COUNT(*) AS followersCount')) {
          return [
            { followersCount: follows.filter((f) => f.followed_player_id === r.playerId).length },
          ];
        }
        if (sql.includes('COUNT(*) AS followingCount')) {
          return [
            { followingCount: follows.filter((f) => f.follower_player_id === r.playerId).length },
          ];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'player_follows') {
            follows.push(
              ...rows.map((row) => ({
                follower_player_id: row.follower_player_id as string,
                followed_player_id: row.followed_player_id as string,
              })),
            );
          }
        },
        bulkDelete: async (table: string, where: Record<string, unknown>) => {
          if (table === 'player_follows') {
            follows = follows.filter(
              (f) =>
                !(
                  f.follower_player_id === where.follower_player_id &&
                  f.followed_player_id === where.followed_player_id
                ),
            );
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

describe('POST/DELETE /players/:playerId/follow (backlog B-9)', () => {
  beforeEach(() => {
    follows = [];
  });

  it('follows a player', async () => {
    const token = await tokenFor(FOLLOWER_USER);
    const res = await request(app)
      .post(`/players/${TARGET_PLAYER}/follow`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ following: true });
    expect(follows).toHaveLength(1);
  });

  it('rejects following yourself with 409', async () => {
    const token = await tokenFor(FOLLOWER_USER);
    const res = await request(app)
      .post(`/players/${FOLLOWER_PLAYER}/follow`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('404s following a player that does not exist', async () => {
    const token = await tokenFor(FOLLOWER_USER);
    const res = await request(app)
      .post('/players/does-not-exist/follow')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('unfollows a player', async () => {
    follows.push({ follower_player_id: FOLLOWER_PLAYER, followed_player_id: TARGET_PLAYER });
    const token = await tokenFor(FOLLOWER_USER);

    const res = await request(app)
      .delete(`/players/${TARGET_PLAYER}/follow`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ following: false });
    expect(follows).toHaveLength(0);
  });

  it('rejects an unauthenticated follow request', async () => {
    const res = await request(app).post(`/players/${TARGET_PLAYER}/follow`);
    expect(res.status).toBe(401);
  });
});
