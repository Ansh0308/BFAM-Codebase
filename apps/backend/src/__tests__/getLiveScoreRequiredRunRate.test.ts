// Regression for a real bug fixed alongside A-19 (auto-finalize on
// target/overs-complete): getLiveScore's Required Run Rate calculation
// hardcoded a 20-over (T20) balls-remaining cap regardless of the match's
// actual overs_per_innings, badly understating balls remaining (and so
// overstating RRR) for any shorter match — which every match in this app
// typically is.

interface MatchRow {
  match_id: string;
  extras_count_toward_score: boolean;
  overs_per_innings: number;
}
interface InningsRow {
  innings_id: string;
  match_id: string;
  innings_number: number;
  total_runs: number;
  total_wickets: number;
  overs_completed: number;
  innings_status: string;
  target_runs: number | null;
}

let match: MatchRow;
let innings: InningsRow;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM matches WHERE match_id')) {
          return match.match_id === r.matchId ? [match] : [];
        }
        if (sql.includes('FROM innings WHERE match_id')) {
          return innings.match_id === r.matchId ? [innings] : [];
        }
        if (sql.includes('FROM score_events WHERE innings_id')) {
          return [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
    },
  };
});

import { getLiveScore } from '../services/scoringService';

describe("getLiveScore — Required Run Rate uses the match's real overs (fix for A-19)", () => {
  beforeEach(() => {
    match = {
      match_id: 'match-1',
      extras_count_toward_score: true,
      overs_per_innings: 8, // this app's matches are far shorter than a T20's 20.
    };
    innings = {
      innings_id: 'innings-1',
      match_id: 'match-1',
      innings_number: 2,
      total_runs: 40,
      total_wickets: 2,
      overs_completed: 4.0, // 24 legal balls bowled, 4 overs left (24 balls) at 8-over cap.
      innings_status: 'IN_PROGRESS',
      target_runs: 80,
    };
  });

  it("computes RRR against the match's actual overs_per_innings, not a hardcoded 20-over cap", async () => {
    const result = await getLiveScore('match-1');

    // 40 more runs needed off the 24 legal balls left in an 8-over match
    // (4 overs remaining) = 10 RRR.
    expect(result.required_run_rate).toBe(10);
  });

  it('returns null RRR once there are no balls left, instead of a wildly wrong number', async () => {
    innings.overs_completed = 8.0; // fully used up.
    const result = await getLiveScore('match-1');

    expect(result.required_run_rate).toBeNull();
  });

  it('returns null RRR for a first innings (no target set)', async () => {
    innings.target_runs = null;
    const result = await getLiveScore('match-1');

    expect(result.required_run_rate).toBeNull();
  });
});
