import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  MatchNotFoundError,
  MatchNotYetCompletedError,
  PlayerAlreadyRatedError,
  PlayerProfileNotFoundError,
  PlayerRatingNotEligibleError,
} from '../domain/errors';

// Backlog G-03 (PRD §12.31, Community Rating): a peer-rated "how was this
// player to play with" signal, deliberately modeled on the existing
// post-match turf review flow (backlog B-4, reviewService.ts) — same
// one-per-pair-per-match uniqueness, same recompute-the-average-at-write-
// time pattern. Unlike a turf review, there's no coin reward here (never
// specified for this signal) and the "reviewed" entity is another player,
// not the turf.

interface MatchRow {
  match_id: string;
  match_status: string;
}

async function resolvePlayerId(userId: string): Promise<string> {
  const [player] = await sequelize.query<{ player_id: string }>(
    'SELECT player_id FROM players WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  if (!player) throw new PlayerProfileNotFoundError();
  return player.player_id;
}

async function fetchMatch(matchId: string): Promise<MatchRow | null> {
  const [row] = await sequelize.query<MatchRow>(
    'SELECT match_id, match_status FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return row ?? null;
}

async function wasConfirmedOnRoster(matchId: string, playerId: string): Promise<boolean> {
  const [row] = await sequelize.query<{ player_id: string }>(
    `SELECT player_id FROM match_players
     WHERE match_id = :matchId AND player_id = :playerId AND invitation_status = 'CONFIRMED'`,
    { type: QueryTypes.SELECT, replacements: { matchId, playerId } },
  );
  return Boolean(row);
}

// Same "aggregate from the ledger at write time" approach reviewService.ts
// uses for turfs.average_rating — players.community_rating is never a
// value that could drift from what player_ratings actually says. Null
// (not 0) when nobody has rated this player yet, distinct from a real low
// average.
async function recomputeCommunityRating(playerId: string, transaction: unknown) {
  const [{ avgRating }] = await sequelize.query<{ avgRating: number | null }>(
    'SELECT AVG(rating) AS avgRating FROM player_ratings WHERE ratee_player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { playerId }, transaction: transaction as never },
  );
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'players',
      { community_rating: avgRating != null ? Math.round(Number(avgRating) * 100) / 100 : null },
      { player_id: playerId },
      { transaction: transaction as never },
    );
}

export interface SubmitPlayerRatingInput {
  match_id: string;
  ratee_player_id: string;
  rating: number;
}

// Submit a Community Rating for a teammate (backlog G-03) — one per
// (match, rater, ratee), only once the match has finished, and only for
// someone who was actually a confirmed player on that same match (you
// can't rate a stranger, or someone who was invited but never confirmed).
export async function submitPlayerRating(actorUserId: string, input: SubmitPlayerRatingInput) {
  const raterPlayerId = await resolvePlayerId(actorUserId);
  if (raterPlayerId === input.ratee_player_id) {
    throw new PlayerRatingNotEligibleError('You cannot rate yourself.');
  }

  const match = await fetchMatch(input.match_id);
  if (!match) throw new MatchNotFoundError(input.match_id);
  if (match.match_status !== 'COMPLETED') throw new MatchNotYetCompletedError();

  const [raterWasOnRoster, rateeWasOnRoster] = await Promise.all([
    wasConfirmedOnRoster(input.match_id, raterPlayerId),
    wasConfirmedOnRoster(input.match_id, input.ratee_player_id),
  ]);
  if (!raterWasOnRoster) {
    throw new PlayerRatingNotEligibleError(
      'You can only rate teammates from a match you played in.',
    );
  }
  if (!rateeWasOnRoster) {
    throw new PlayerRatingNotEligibleError('That player was not a confirmed player in this match.');
  }

  const [existing] = await sequelize.query<{ player_rating_id: string }>(
    `SELECT player_rating_id FROM player_ratings
     WHERE match_id = :matchId AND rater_player_id = :raterId AND ratee_player_id = :rateeId`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        matchId: input.match_id,
        raterId: raterPlayerId,
        rateeId: input.ratee_player_id,
      },
    },
  );
  if (existing) throw new PlayerAlreadyRatedError();

  const playerRatingId = randomUUID();
  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    await sequelize.getQueryInterface().bulkInsert(
      'player_ratings',
      [
        {
          player_rating_id: playerRatingId,
          match_id: input.match_id,
          rater_player_id: raterPlayerId,
          ratee_player_id: input.ratee_player_id,
          rating: input.rating,
          created_at: now,
        },
      ],
      { transaction },
    );
    await recomputeCommunityRating(input.ratee_player_id, transaction);
  });

  return { player_rating_id: playerRatingId };
}

// Every confirmed teammate the caller can still rate for a given match —
// everyone else on the confirmed roster, minus themself and anyone already
// rated. Drives the mobile "Rate Your Teammates" prompt after a review.
export async function listRateableTeammates(actorUserId: string, matchId: string) {
  const raterPlayerId = await resolvePlayerId(actorUserId);

  const roster = await sequelize.query<{
    player_id: string;
    bfam_id: string;
    full_name: string | null;
  }>(
    `SELECT p.player_id, p.bfam_id, p.full_name
     FROM match_players mp
     JOIN players p ON p.player_id = mp.player_id
     WHERE mp.match_id = :matchId AND mp.invitation_status = 'CONFIRMED' AND mp.player_id != :raterPlayerId`,
    { type: QueryTypes.SELECT, replacements: { matchId, raterPlayerId } },
  );

  const alreadyRated = await sequelize.query<{ ratee_player_id: string }>(
    'SELECT ratee_player_id FROM player_ratings WHERE match_id = :matchId AND rater_player_id = :raterPlayerId',
    { type: QueryTypes.SELECT, replacements: { matchId, raterPlayerId } },
  );
  const ratedIds = new Set(alreadyRated.map((r) => r.ratee_player_id));

  return roster.filter((p) => !ratedIds.has(p.player_id));
}
