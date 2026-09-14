// Backlog G-03 (Community Rating): peer-rated "how was this player to play
// with" — one per (match, rater, ratee), only for a match both were
// confirmed on, only once it's completed. Only `sequelize` is faked.

interface MatchRow {
  match_id: string;
  match_status: string;
}
interface MatchPlayerRow {
  match_id: string;
  player_id: string;
  invitation_status: string;
}
interface PlayerRatingRow {
  player_rating_id: string;
  match_id: string;
  rater_player_id: string;
  ratee_player_id: string;
  rating: number;
}

const MATCH_ID = 'match-1';
const RATER = 'player-rater';
const RATEE = 'player-ratee';
const OUTSIDER = 'player-outsider';

const matches: MatchRow[] = [{ match_id: MATCH_ID, match_status: 'COMPLETED' }];
const matchPlayers: MatchPlayerRow[] = [
  { match_id: MATCH_ID, player_id: RATER, invitation_status: 'CONFIRMED' },
  { match_id: MATCH_ID, player_id: RATEE, invitation_status: 'CONFIRMED' },
];
let playerRatings: PlayerRatingRow[] = [];
const playersTable: Record<string, { community_rating: number | null }> = {
  [RATEE]: { community_rating: null },
};
const usersByPlayer: Record<string, string> = {
  [RATER]: 'user-rater',
  [RATEE]: 'user-ratee',
  [OUTSIDER]: 'user-outsider',
};

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          const entry = Object.entries(usersByPlayer).find(([, u]) => u === r.userId);
          return entry ? [{ player_id: entry[0] }] : [];
        }
        if (sql.includes('SELECT match_id, match_status FROM matches')) {
          const m = matches.find((x) => x.match_id === r.matchId);
          return m ? [m] : [];
        }
        if (sql.startsWith('SELECT player_id FROM match_players')) {
          const row = matchPlayers.find(
            (p) => p.match_id === r.matchId && p.player_id === r.playerId,
          );
          return row ? [row] : [];
        }
        if (sql.includes('SELECT p.player_id, p.bfam_id, p.full_name')) {
          return matchPlayers
            .filter(
              (p) =>
                p.match_id === r.matchId &&
                p.invitation_status === 'CONFIRMED' &&
                p.player_id !== r.raterPlayerId,
            )
            .map((p) => ({
              player_id: p.player_id,
              bfam_id: `BF-${p.player_id}`,
              full_name: null,
            }));
        }
        if (sql.startsWith('SELECT ratee_player_id FROM player_ratings')) {
          return playerRatings
            .filter((p) => p.match_id === r.matchId && p.rater_player_id === r.raterPlayerId)
            .map((p) => ({ ratee_player_id: p.ratee_player_id }));
        }
        if (sql.startsWith('SELECT player_rating_id FROM player_ratings')) {
          const row = playerRatings.find(
            (p) =>
              p.match_id === r.matchId &&
              p.rater_player_id === r.raterId &&
              p.ratee_player_id === r.rateeId,
          );
          return row ? [row] : [];
        }
        if (sql.includes('AVG(rating) AS avgRating FROM player_ratings')) {
          const ratings = playerRatings
            .filter((p) => p.ratee_player_id === r.playerId)
            .map((p) => p.rating);
          const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
          return [{ avgRating: avg }];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'player_ratings')
            playerRatings.push(...(rows as unknown as PlayerRatingRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'players') {
            const row = playersTable[where.player_id as string];
            if (row) Object.assign(row, values);
          }
        },
      }),
    },
  };
});

import { submitPlayerRating, listRateableTeammates } from '../services/playerRatingService';
import {
  MatchNotFoundError,
  MatchNotYetCompletedError,
  PlayerAlreadyRatedError,
  PlayerRatingNotEligibleError,
} from '../domain/errors';

describe('submitPlayerRating (backlog G-03)', () => {
  beforeEach(() => {
    playerRatings = [];
    playersTable[RATEE].community_rating = null;
  });

  it('records a rating and recomputes the ratee community_rating', async () => {
    const result = await submitPlayerRating('user-rater', {
      match_id: MATCH_ID,
      ratee_player_id: RATEE,
      rating: 4,
    });

    expect(result.player_rating_id).toBeTruthy();
    expect(playerRatings).toHaveLength(1);
    expect(playersTable[RATEE].community_rating).toBe(4);
  });

  it('averages multiple ratings', async () => {
    playerRatings.push({
      player_rating_id: 'existing-1',
      match_id: 'match-0',
      rater_player_id: 'someone-else',
      ratee_player_id: RATEE,
      rating: 2,
    });

    await submitPlayerRating('user-rater', {
      match_id: MATCH_ID,
      ratee_player_id: RATEE,
      rating: 4,
    });

    expect(playersTable[RATEE].community_rating).toBe(3);
  });

  it('rejects rating yourself', async () => {
    await expect(
      submitPlayerRating('user-rater', {
        match_id: MATCH_ID,
        ratee_player_id: RATER,
        rating: 5,
      }),
    ).rejects.toThrow(PlayerRatingNotEligibleError);
  });

  it('rejects a match that does not exist', async () => {
    await expect(
      submitPlayerRating('user-rater', {
        match_id: 'no-such-match',
        ratee_player_id: RATEE,
        rating: 5,
      }),
    ).rejects.toThrow(MatchNotFoundError);
  });

  it('rejects rating for a match that has not completed', async () => {
    matches.push({ match_id: 'match-pending', match_status: 'IN_PROGRESS' });
    matchPlayers.push(
      { match_id: 'match-pending', player_id: RATER, invitation_status: 'CONFIRMED' },
      { match_id: 'match-pending', player_id: RATEE, invitation_status: 'CONFIRMED' },
    );

    await expect(
      submitPlayerRating('user-rater', {
        match_id: 'match-pending',
        ratee_player_id: RATEE,
        rating: 5,
      }),
    ).rejects.toThrow(MatchNotYetCompletedError);
  });

  it('rejects a ratee who was not a confirmed player in this match', async () => {
    await expect(
      submitPlayerRating('user-rater', {
        match_id: MATCH_ID,
        ratee_player_id: OUTSIDER,
        rating: 5,
      }),
    ).rejects.toThrow(PlayerRatingNotEligibleError);
  });

  it('rejects rating the same teammate for the same match twice', async () => {
    await submitPlayerRating('user-rater', {
      match_id: MATCH_ID,
      ratee_player_id: RATEE,
      rating: 4,
    });

    await expect(
      submitPlayerRating('user-rater', {
        match_id: MATCH_ID,
        ratee_player_id: RATEE,
        rating: 2,
      }),
    ).rejects.toThrow(PlayerAlreadyRatedError);
  });
});

describe('listRateableTeammates (backlog G-03)', () => {
  beforeEach(() => {
    playerRatings = [];
  });

  it('lists confirmed teammates other than the caller', async () => {
    const results = await listRateableTeammates('user-rater', MATCH_ID);
    expect(results.map((r) => r.player_id)).toEqual([RATEE]);
  });

  it('excludes a teammate already rated', async () => {
    await submitPlayerRating('user-rater', {
      match_id: MATCH_ID,
      ratee_player_id: RATEE,
      rating: 5,
    });

    const results = await listRateableTeammates('user-rater', MATCH_ID);
    expect(results).toHaveLength(0);
  });
});
