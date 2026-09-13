// Integration test for backlog B-5's wiring: materializeMatchStatistics
// should also materialize one FAIR_PLAY/RELIABILITY rating event per
// confirmed roster player, scored by how evenly their match_team shared
// balls faced/bowled — see domain/rating.ts (ratingMath.test.ts) for the
// formula itself, which this test does not re-verify in detail. Only
// `sequelize` is faked.

interface MatchPlayerRow {
  match_id: string;
  player_id: string;
  match_team_id: string | null;
  invitation_status: string;
}

const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000000201';
const TEAM_A = 'dddddddd-0000-4000-8000-000000000204';
const TEAM_B = 'eeeeeeee-0000-4000-8000-000000000205';
// Team A: P1 faced every ball, P2 faced none (maximally unfair batting share).
const P1 = '11111111-0000-4000-8000-000000000206';
const P2 = '22222222-0000-4000-8000-000000000207';
// Team B: P3 and P4 split bowling evenly (perfectly fair).
const P3 = '33333333-0000-4000-8000-000000000208';
const P4 = '44444444-0000-4000-8000-000000000209';

const matchPlayers: MatchPlayerRow[] = [
  { match_id: MATCH_ID, player_id: P1, match_team_id: TEAM_A, invitation_status: 'CONFIRMED' },
  { match_id: MATCH_ID, player_id: P2, match_team_id: TEAM_A, invitation_status: 'CONFIRMED' },
  { match_id: MATCH_ID, player_id: P3, match_team_id: TEAM_B, invitation_status: 'CONFIRMED' },
  { match_id: MATCH_ID, player_id: P4, match_team_id: TEAM_B, invitation_status: 'CONFIRMED' },
];

// Every ball in this innings is faced by P1 (team A batting) and bowled
// alternately by P3/P4 (team B bowling) — six deliveries, three each.
const scoreEvents = [
  {
    striker_player_id: P1,
    bowler_player_id: P3,
    runs_scored: 1,
    extra_type: 'NONE',
    extra_runs: 0,
    is_wicket: false,
    wicket_type: null,
    fielder_player_id: null,
  },
  {
    striker_player_id: P1,
    bowler_player_id: P4,
    runs_scored: 1,
    extra_type: 'NONE',
    extra_runs: 0,
    is_wicket: false,
    wicket_type: null,
    fielder_player_id: null,
  },
  {
    striker_player_id: P1,
    bowler_player_id: P3,
    runs_scored: 1,
    extra_type: 'NONE',
    extra_runs: 0,
    is_wicket: false,
    wicket_type: null,
    fielder_player_id: null,
  },
  {
    striker_player_id: P1,
    bowler_player_id: P4,
    runs_scored: 1,
    extra_type: 'NONE',
    extra_runs: 0,
    is_wicket: false,
    wicket_type: null,
    fielder_player_id: null,
  },
  {
    striker_player_id: P1,
    bowler_player_id: P3,
    runs_scored: 1,
    extra_type: 'NONE',
    extra_runs: 0,
    is_wicket: false,
    wicket_type: null,
    fielder_player_id: null,
  },
  {
    striker_player_id: P1,
    bowler_player_id: P4,
    runs_scored: 1,
    extra_type: 'NONE',
    extra_runs: 0,
    is_wicket: false,
    wicket_type: null,
    fielder_player_id: null,
  },
];

const playerRatingEvents: Record<string, unknown>[] = [];
const playersTable: Record<string, { reliability_score: number; skill_rating: number }> = {
  [P1]: { reliability_score: 100, skill_rating: 500 },
  [P2]: { reliability_score: 100, skill_rating: 500 },
  [P3]: { reliability_score: 100, skill_rating: 500 },
  [P4]: { reliability_score: 100, skill_rating: 500 },
};

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM matches WHERE match_id')) {
          return [{ match_id: MATCH_ID, match_status: 'IN_PROGRESS' }];
        }
        if (sql.includes('FROM score_events se') && sql.includes('JOIN innings')) {
          return scoreEvents;
        }
        if (sql.includes('FROM match_results WHERE match_id')) {
          return [];
        }
        if (
          sql.includes('SELECT player_id, match_team_id FROM match_players') &&
          !sql.includes('invitation_status')
        ) {
          return matchPlayers.filter((p) => p.match_id === r.matchId);
        }
        if (sql.includes('FROM players WHERE player_id IN')) {
          return [];
        }
        if (sql.includes("event_type = 'MATCH_PERFORMANCE' AND rating_dimension = 'SKILL'")) {
          return [];
        }
        if (
          sql.includes('FROM player_rating_events') &&
          sql.includes("rating_dimension = 'SKILL'")
        ) {
          return [];
        }
        if (
          sql.includes('SELECT player_id, match_team_id FROM match_players') &&
          sql.includes("invitation_status = 'CONFIRMED'")
        ) {
          return matchPlayers.filter(
            (p) => p.match_id === r.matchId && p.invitation_status === 'CONFIRMED',
          );
        }
        if (sql.includes("event_type = 'FAIR_PLAY' AND rating_dimension = 'RELIABILITY'")) {
          return [];
        }
        if (sql.includes("rating_dimension = 'RELIABILITY'")) {
          const playerId = r.playerId as string;
          return [
            {
              resulting_value: playersTable[playerId]?.reliability_score ?? 100,
            },
          ];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkDelete: async () => undefined,
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'player_rating_events') playerRatingEvents.push(...rows);
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

import { materializeMatchStatistics } from '../services/statisticsService';

describe('materializeMatchStatistics — Fair Play events (backlog B-5)', () => {
  beforeEach(() => {
    playerRatingEvents.length = 0;
    playersTable[P1].reliability_score = 100;
    playersTable[P2].reliability_score = 100;
    playersTable[P3].reliability_score = 100;
    playersTable[P4].reliability_score = 100;
  });

  it('penalizes every player on the side that shared its chances unfairly, equally', async () => {
    await materializeMatchStatistics(MATCH_ID);

    const fairPlayEvents = playerRatingEvents.filter((e) => e.event_type === 'FAIR_PLAY');
    const p1Event = fairPlayEvents.find((e) => e.player_id === P1);
    const p2Event = fairPlayEvents.find((e) => e.player_id === P2);

    expect(p1Event).toBeDefined();
    expect(p2Event).toBeDefined();
    // Team A's batting fairness is minimally unfair (2 players, all balls to
    // one) — both P1 and P2 get the identical penalty, since fairness is a
    // property of the side, not the individual.
    expect(p1Event!.rating_delta).toBe(p2Event!.rating_delta);
    expect(p1Event!.rating_delta as number).toBeLessThan(0);
    expect(playersTable[P1].reliability_score).toBeLessThan(100);
    expect(playersTable[P2].reliability_score).toBe(playersTable[P1].reliability_score);
  });

  it('does not penalize the side that shared its chances perfectly evenly', async () => {
    await materializeMatchStatistics(MATCH_ID);

    const fairPlayEvents = playerRatingEvents.filter((e) => e.event_type === 'FAIR_PLAY');
    const p3Event = fairPlayEvents.find((e) => e.player_id === P3);
    const p4Event = fairPlayEvents.find((e) => e.player_id === P4);

    expect(p3Event!.rating_delta).toBe(0);
    expect(p4Event!.rating_delta).toBe(0);
    expect(playersTable[P3].reliability_score).toBe(100);
    expect(playersTable[P4].reliability_score).toBe(100);
  });
});
