import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { sendNotificationToMany } from './notificationService';
import {
  CannotFollowSelfError,
  PlayerNotFoundError,
  PlayerProfileNotFoundError,
} from '../domain/errors';

// Backlog B-9: a follows social graph between players. Deliberately
// scoped to counts + follow/unfollow + the play notification, per the
// feedback's own wording ("show follower/following counts... notify a
// user whenever someone they follow plays a match") — a full followers/
// following list screen isn't part of this MVP pass.

async function resolvePlayerId(userId: string): Promise<string> {
  const [player] = await sequelize.query<{ player_id: string }>(
    'SELECT player_id FROM players WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  if (!player) throw new PlayerProfileNotFoundError();
  return player.player_id;
}

async function assertPlayerExists(playerId: string) {
  const [row] = await sequelize.query<{ player_id: string }>(
    'SELECT player_id FROM players WHERE player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );
  if (!row) throw new PlayerNotFoundError(playerId);
}

// Idempotent — following someone you already follow is a no-op, not an
// error, matching the toggle-button UX a follow action typically has.
export async function followPlayer(actorUserId: string, targetPlayerId: string) {
  const followerId = await resolvePlayerId(actorUserId);
  if (followerId === targetPlayerId) throw new CannotFollowSelfError();
  await assertPlayerExists(targetPlayerId);

  const [existing] = await sequelize.query<{ follow_id: string }>(
    'SELECT follow_id FROM player_follows WHERE follower_player_id = :followerId AND followed_player_id = :targetId',
    { type: QueryTypes.SELECT, replacements: { followerId, targetId: targetPlayerId } },
  );
  if (existing) return { following: true };

  await sequelize.getQueryInterface().bulkInsert('player_follows', [
    {
      follow_id: randomUUID(),
      follower_player_id: followerId,
      followed_player_id: targetPlayerId,
      created_at: new Date(),
    },
  ]);
  return { following: true };
}

// Idempotent — unfollowing someone you don't follow is a no-op.
export async function unfollowPlayer(actorUserId: string, targetPlayerId: string) {
  const followerId = await resolvePlayerId(actorUserId);
  await sequelize.getQueryInterface().bulkDelete('player_follows', {
    follower_player_id: followerId,
    followed_player_id: targetPlayerId,
  });
  return { following: false };
}

export interface FollowSummary {
  followers_count: number;
  following_count: number;
  is_following: boolean;
}

// `viewerUserId` is optional so this also works for a caller looking at
// their own profile (no "is_following myself" question to answer) or an
// unauthenticated-context read — every current caller is authenticated,
// but the function itself doesn't need to assume that.
export async function getFollowSummary(
  playerId: string,
  viewerUserId?: string,
): Promise<FollowSummary> {
  const [{ followersCount }] = await sequelize.query<{ followersCount: number }>(
    'SELECT COUNT(*) AS followersCount FROM player_follows WHERE followed_player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );
  const [{ followingCount }] = await sequelize.query<{ followingCount: number }>(
    'SELECT COUNT(*) AS followingCount FROM player_follows WHERE follower_player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );

  let isFollowing = false;
  if (viewerUserId) {
    const viewerPlayerId = await resolvePlayerId(viewerUserId).catch(() => null);
    if (viewerPlayerId) {
      const [existing] = await sequelize.query<{ follow_id: string }>(
        'SELECT follow_id FROM player_follows WHERE follower_player_id = :viewerPlayerId AND followed_player_id = :playerId',
        { type: QueryTypes.SELECT, replacements: { viewerPlayerId, playerId } },
      );
      isFollowing = Boolean(existing);
    }
  }

  return {
    followers_count: Number(followersCount),
    following_count: Number(followingCount),
    is_following: isFollowing,
  };
}

// Called from matchIntroService.startIntro alongside the existing
// MATCH_STARTING notification to the roster itself — every follower of a
// confirmed roster player gets told that player just started playing,
// except a follower who is themself on the roster (they already got
// MATCH_STARTING). Never allowed to fail the action that triggered it.
export async function notifyFollowersOfMatchStart(
  matchId: string,
  matchName: string | null,
  confirmedPlayerIds: string[],
) {
  if (confirmedPlayerIds.length === 0) return;
  try {
    const rosterUserIds = new Set(
      (
        await sequelize.query<{ user_id: string }>(
          `SELECT p.user_id FROM players p WHERE p.player_id IN (:playerIds)`,
          { type: QueryTypes.SELECT, replacements: { playerIds: confirmedPlayerIds } },
        )
      ).map((r) => r.user_id),
    );

    const players = await sequelize.query<{
      player_id: string;
      bfam_id: string;
      full_name: string | null;
    }>('SELECT player_id, bfam_id, full_name FROM players WHERE player_id IN (:playerIds)', {
      type: QueryTypes.SELECT,
      replacements: { playerIds: confirmedPlayerIds },
    });

    for (const player of players) {
      const followers = await sequelize.query<{ user_id: string }>(
        `SELECT u.user_id FROM player_follows pf
         JOIN players fp ON fp.player_id = pf.follower_player_id
         JOIN users u ON u.user_id = fp.user_id
         WHERE pf.followed_player_id = :playerId`,
        { type: QueryTypes.SELECT, replacements: { playerId: player.player_id } },
      );
      const recipients = followers
        .map((f) => f.user_id)
        .filter((userId) => !rosterUserIds.has(userId));
      if (recipients.length === 0) continue;

      await sendNotificationToMany(
        recipients,
        'PLAYER_PLAYING',
        {
          playerName: player.full_name || player.bfam_id,
          matchName: matchName ?? 'a match',
        },
        'match',
        matchId,
      );
    }
  } catch (error) {
    console.error(`[followService] Failed to notify followers for match ${matchId}:`, error);
  }
}
