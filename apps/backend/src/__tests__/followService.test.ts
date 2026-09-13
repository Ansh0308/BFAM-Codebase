// Integration tests for backlog B-9's follow service: idempotent follow/
// unfollow, counts, and notifying followers when a followed player starts
// playing. Only `sequelize` and notificationService are faked.

interface PlayerRow {
  player_id: string;
  user_id: string;
  bfam_id: string;
  full_name: string | null;
}

const FOLLOWER_USER = 'aaaaaaaa-0000-4000-8000-000000001401';
const FOLLOWER_PLAYER = 'bbbbbbbb-0000-4000-8000-000000001402';
const TARGET_PLAYER = 'cccccccc-0000-4000-8000-000000001403';
const TARGET_USER = 'dddddddd-0000-4000-8000-000000001404';

const players: PlayerRow[] = [
  { player_id: FOLLOWER_PLAYER, user_id: FOLLOWER_USER, bfam_id: 'BF1001', full_name: 'Follower' },
  { player_id: TARGET_PLAYER, user_id: TARGET_USER, bfam_id: 'BF1002', full_name: 'Target Player' },
];
let follows: { follower_player_id: string; followed_player_id: string }[];
const mockSendNotificationToMany = jest.fn();

jest.mock('../services/notificationService', () => ({
  sendNotificationToMany: (...args: unknown[]) => mockSendNotificationToMany(...args),
}));

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          const p = players.find((x) => x.user_id === r.userId);
          return p ? [{ player_id: p.player_id }] : [];
        }
        if (sql.includes('SELECT player_id FROM players WHERE player_id')) {
          const p = players.find((x) => x.player_id === r.playerId);
          return p ? [{ player_id: p.player_id }] : [];
        }
        if (
          sql.includes('SELECT follow_id FROM player_follows WHERE follower_player_id') &&
          sql.includes('AND followed_player_id')
        ) {
          const existing = follows.find(
            (f) =>
              f.follower_player_id === (r.followerId ?? r.viewerPlayerId) &&
              f.followed_player_id === (r.targetId ?? r.playerId),
          );
          return existing ? [{ follow_id: 'f1' }] : [];
        }
        if (sql.includes('COUNT(*) AS followersCount')) {
          const count = follows.filter((f) => f.followed_player_id === r.playerId).length;
          return [{ followersCount: count }];
        }
        if (sql.includes('COUNT(*) AS followingCount')) {
          const count = follows.filter((f) => f.follower_player_id === r.playerId).length;
          return [{ followingCount: count }];
        }
        if (sql.includes('FROM players p WHERE p.player_id IN')) {
          const ids = r.playerIds as string[];
          return players
            .filter((p) => ids.includes(p.player_id))
            .map((p) => ({ user_id: p.user_id }));
        }
        if (sql.includes('SELECT player_id, bfam_id, full_name FROM players WHERE player_id IN')) {
          const ids = r.playerIds as string[];
          return players.filter((p) => ids.includes(p.player_id));
        }
        if (sql.includes('FROM player_follows pf')) {
          const followerRows = follows
            .filter((f) => f.followed_player_id === r.playerId)
            .map((f) => players.find((p) => p.player_id === f.follower_player_id))
            .filter((p): p is PlayerRow => Boolean(p));
          return followerRows.map((p) => ({ user_id: p.user_id }));
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

import {
  followPlayer,
  getFollowSummary,
  notifyFollowersOfMatchStart,
  unfollowPlayer,
} from '../services/followService';

describe('Follow service (backlog B-9)', () => {
  beforeEach(() => {
    follows = [];
    mockSendNotificationToMany.mockReset().mockResolvedValue(undefined);
  });

  it('follows a player and it is reflected in counts', async () => {
    await followPlayer(FOLLOWER_USER, TARGET_PLAYER);

    const summary = await getFollowSummary(TARGET_PLAYER, FOLLOWER_USER);
    expect(summary).toEqual({ followers_count: 1, following_count: 0, is_following: true });
  });

  it('is idempotent — following twice does not double-count', async () => {
    await followPlayer(FOLLOWER_USER, TARGET_PLAYER);
    await followPlayer(FOLLOWER_USER, TARGET_PLAYER);

    const summary = await getFollowSummary(TARGET_PLAYER);
    expect(summary.followers_count).toBe(1);
  });

  it('rejects following yourself', async () => {
    await expect(followPlayer(FOLLOWER_USER, FOLLOWER_PLAYER)).rejects.toThrow(/yourself/i);
  });

  it('rejects following a player that does not exist', async () => {
    await expect(followPlayer(FOLLOWER_USER, 'no-such-player')).rejects.toThrow();
  });

  it('unfollows a player, idempotently', async () => {
    await followPlayer(FOLLOWER_USER, TARGET_PLAYER);
    await unfollowPlayer(FOLLOWER_USER, TARGET_PLAYER);
    await unfollowPlayer(FOLLOWER_USER, TARGET_PLAYER); // no-op, must not throw

    const summary = await getFollowSummary(TARGET_PLAYER);
    expect(summary.followers_count).toBe(0);
  });

  it('notifies followers when the followed player starts playing', async () => {
    await followPlayer(FOLLOWER_USER, TARGET_PLAYER);

    await notifyFollowersOfMatchStart('match-1', 'Sunday Cricket', [TARGET_PLAYER]);

    expect(mockSendNotificationToMany).toHaveBeenCalledWith(
      [FOLLOWER_USER],
      'PLAYER_PLAYING',
      { playerName: 'Target Player', matchName: 'Sunday Cricket' },
      'match',
      'match-1',
    );
  });

  it('does not notify a follower who is themself on the match roster', async () => {
    await followPlayer(FOLLOWER_USER, TARGET_PLAYER);

    // The follower is also confirmed on this match's roster.
    await notifyFollowersOfMatchStart('match-1', 'Sunday Cricket', [
      TARGET_PLAYER,
      FOLLOWER_PLAYER,
    ]);

    expect(mockSendNotificationToMany).not.toHaveBeenCalled();
  });

  it('never throws even if something inside fails', async () => {
    await expect(
      notifyFollowersOfMatchStart('match-1', 'Sunday Cricket', ['unknown-player-id']),
    ).resolves.toBeUndefined();
  });
});
