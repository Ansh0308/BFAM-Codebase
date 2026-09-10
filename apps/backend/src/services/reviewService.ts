import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { earnCoins } from './coinsService';
import {
  MatchNotFoundError,
  MatchNotYetCompletedError,
  PlayerProfileNotFoundError,
  ReviewAlreadySubmittedError,
} from '../domain/errors';

// Backlog B-4: post-match review reward. No prior product decision on the
// exact amount — documented here as the concrete MVP default.
export const COIN_REWARD_PER_REVIEW = 20;

interface MatchRow {
  match_id: string;
  match_status: string;
  booking_id: string;
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
    'SELECT match_id, match_status, booking_id FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return row ?? null;
}

async function resolveTurfId(bookingId: string): Promise<string> {
  const [row] = await sequelize.query<{ turf_id: string }>(
    'SELECT turf_id FROM bookings WHERE booking_id = :bookingId',
    { type: QueryTypes.SELECT, replacements: { bookingId } },
  );
  if (!row) throw new MatchNotFoundError(bookingId);
  return row.turf_id;
}

// Recomputes turfs.average_rating directly from the reviews table, the
// same "aggregate from the ledger at write time" approach used elsewhere
// in this codebase (e.g. players.skill_rating from player_rating_events) —
// never a value that could drift from what reviews actually say.
async function recomputeTurfAverageRating(turfId: string, transaction: unknown) {
  const [{ avgRating }] = await sequelize.query<{ avgRating: number | null }>(
    'SELECT AVG(rating) AS avgRating FROM reviews WHERE turf_id = :turfId',
    { type: QueryTypes.SELECT, replacements: { turfId }, transaction: transaction as never },
  );
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'turfs',
      { average_rating: avgRating != null ? Math.round(Number(avgRating) * 100) / 100 : null },
      { turf_id: turfId },
      { transaction: transaction as never },
    );
}

export interface SubmitReviewInput {
  match_id: string;
  rating: number;
  review_text?: string | null;
}

// Submit a review (backlog B-4) — one per (player, match), only after the
// match has finished, rewarded with a flat COIN_REWARD_PER_REVIEW BFAM
// Coins. The reward makes idempotency matter for real (not just tidiness):
// double-submitting must never double-pay.
export async function submitReview(actorUserId: string, input: SubmitReviewInput) {
  const playerId = await resolvePlayerId(actorUserId);
  const match = await fetchMatch(input.match_id);
  if (!match) throw new MatchNotFoundError(input.match_id);
  if (match.match_status !== 'COMPLETED') throw new MatchNotYetCompletedError();

  const [existing] = await sequelize.query<{ review_id: string }>(
    'SELECT review_id FROM reviews WHERE match_id = :matchId AND player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { matchId: input.match_id, playerId } },
  );
  if (existing) throw new ReviewAlreadySubmittedError();

  const turfId = await resolveTurfId(match.booking_id);
  const reviewId = randomUUID();
  const now = new Date();

  let coinBalance = 0;
  await sequelize.transaction(async (transaction) => {
    await sequelize.getQueryInterface().bulkInsert(
      'reviews',
      [
        {
          review_id: reviewId,
          match_id: input.match_id,
          turf_id: turfId,
          player_id: playerId,
          rating: input.rating,
          review_text: input.review_text ?? null,
          coins_awarded: COIN_REWARD_PER_REVIEW,
          created_at: now,
        },
      ],
      { transaction },
    );

    coinBalance = await earnCoins(
      playerId,
      COIN_REWARD_PER_REVIEW,
      'REVIEW_REWARD',
      { type: 'review', id: reviewId },
      transaction,
    );

    await recomputeTurfAverageRating(turfId, transaction);
  });

  return {
    review_id: reviewId,
    coins_awarded: COIN_REWARD_PER_REVIEW,
    coin_balance: coinBalance,
  };
}

export async function hasReviewedMatch(actorUserId: string, matchId: string): Promise<boolean> {
  const playerId = await resolvePlayerId(actorUserId);
  const [existing] = await sequelize.query<{ review_id: string }>(
    'SELECT review_id FROM reviews WHERE match_id = :matchId AND player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { matchId, playerId } },
  );
  return Boolean(existing);
}
