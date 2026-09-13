// Integration tests for backlog B-4: submitting a post-match review earns
// a flat coin reward and recomputes the turf's average_rating. Only
// `sequelize` is faked — the real service runs unmodified.

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000501';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-000000000502';
const MATCH_ID = 'cccccccc-0000-4000-8000-000000000503';
const BOOKING_ID = 'dddddddd-0000-4000-8000-000000000504';
const TURF_ID = 'eeeeeeee-0000-4000-8000-000000000505';

let match: { match_id: string; match_status: string; booking_id: string } | null;
let reviews: { review_id: string; match_id: string; player_id: string; rating: number }[];
let player: { player_id: string; user_id: string; coin_balance: number };
let turf: { turf_id: string; average_rating: number | null };

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM players WHERE user_id')) {
          return r.userId === player.user_id ? [{ player_id: player.player_id }] : [];
        }
        if (sql.includes('SELECT coin_balance FROM players WHERE player_id')) {
          return r.playerId === player.player_id ? [{ coin_balance: player.coin_balance }] : [];
        }
        if (sql.includes('FROM matches WHERE match_id')) {
          return match && match.match_id === r.matchId ? [match] : [];
        }
        if (sql.includes('FROM reviews WHERE match_id')) {
          const found = reviews.find(
            (rv) => rv.match_id === r.matchId && rv.player_id === (r.playerId ?? player.player_id),
          );
          return found ? [found] : [];
        }
        if (sql.includes('FROM bookings WHERE booking_id')) {
          return r.bookingId === BOOKING_ID ? [{ turf_id: TURF_ID }] : [];
        }
        if (sql.includes('SELECT AVG(rating) AS avgRating FROM reviews')) {
          const turfReviews = reviews.filter(() => true); // single-turf fixture
          const avg =
            turfReviews.length > 0
              ? turfReviews.reduce((s, rv) => s + rv.rating, 0) / turfReviews.length
              : null;
          return [{ avgRating: avg }];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'reviews') {
            reviews.push(
              ...rows.map((row) => ({
                review_id: row.review_id as string,
                match_id: row.match_id as string,
                player_id: row.player_id as string,
                rating: row.rating as number,
              })),
            );
          }
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'players' && where.player_id === player.player_id) {
            Object.assign(player, values);
          }
          if (table === 'turfs' && where.turf_id === TURF_ID) {
            Object.assign(turf, values);
          }
        },
      }),
    },
  };
});

import { submitReview, COIN_REWARD_PER_REVIEW } from '../services/reviewService';

describe('submitReview (backlog B-4)', () => {
  beforeEach(() => {
    match = { match_id: MATCH_ID, match_status: 'COMPLETED', booking_id: BOOKING_ID };
    reviews = [];
    player = { player_id: PLAYER_ID, user_id: USER_ID, coin_balance: 0 };
    turf = { turf_id: TURF_ID, average_rating: null };
  });

  it('rewards a flat coin amount and recomputes the turf average rating', async () => {
    const result = await submitReview(USER_ID, { match_id: MATCH_ID, rating: 4 });

    expect(result.coins_awarded).toBe(COIN_REWARD_PER_REVIEW);
    expect(result.coin_balance).toBe(COIN_REWARD_PER_REVIEW);
    expect(player.coin_balance).toBe(COIN_REWARD_PER_REVIEW);
    expect(turf.average_rating).toBe(4);
  });

  it('rejects a second review for the same match by the same player', async () => {
    await submitReview(USER_ID, { match_id: MATCH_ID, rating: 5 });

    await expect(submitReview(USER_ID, { match_id: MATCH_ID, rating: 3 })).rejects.toThrow(
      /already reviewed/i,
    );
  });

  it('rejects reviewing a match that has not finished yet', async () => {
    match!.match_status = 'IN_PROGRESS';

    await expect(submitReview(USER_ID, { match_id: MATCH_ID, rating: 5 })).rejects.toThrow(
      /finished/i,
    );
  });

  it('rejects reviewing a match that does not exist', async () => {
    match = null;

    await expect(submitReview(USER_ID, { match_id: MATCH_ID, rating: 5 })).rejects.toThrow();
  });
});
