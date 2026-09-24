// Pure unit tests for leaderboardService.ts's aggregateByPlayer — the
// per-match-row -> per-player grouping math, independently testable
// without a database (same reasoning as statisticsService.ts's
// summarizeStatRows tests).

import { aggregateByPlayer } from '../services/leaderboardService';

describe('aggregateByPlayer (long tail — Rankings & Leaderboards)', () => {
  it('sums runs/wickets/sixes/balls across multiple matches for the same player', () => {
    const result = aggregateByPlayer([
      {
        player_id: 'p1',
        bfam_id: 'BF1001',
        full_name: 'Asha Patel',
        runs_scored: 40,
        balls_faced: 30,
        sixes: 2,
        wickets_taken: 1,
        overs_bowled: 2.0,
        runs_conceded: 10,
      },
      {
        player_id: 'p1',
        bfam_id: 'BF1001',
        full_name: 'Asha Patel',
        runs_scored: 25,
        balls_faced: 20,
        sixes: 1,
        wickets_taken: 2,
        overs_bowled: 3.0,
        runs_conceded: 15,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      player_id: 'p1',
      runs: 65,
      wickets: 3,
      sixes: 3,
      ballsFaced: 50,
      legalBallsBowled: 30,
      runsConceded: 25,
    });
  });

  it('correctly sums cricket-notation overs across matches, not decimal arithmetic', () => {
    // 4.3 overs (4 overs, 3 balls = 27 legal balls) + 3.4 overs (3 overs, 4
    // balls = 22 legal balls) = 49 legal balls, NOT 4.3 + 3.4 = 7.7 (which
    // would misread as 7 overs 7 balls, an invalid over).
    const result = aggregateByPlayer([
      {
        player_id: 'p2',
        bfam_id: 'BF1002',
        full_name: 'Rohan Mehta',
        runs_scored: 0,
        balls_faced: 0,
        sixes: 0,
        wickets_taken: 1,
        overs_bowled: 4.3,
        runs_conceded: 20,
      },
      {
        player_id: 'p2',
        bfam_id: 'BF1002',
        full_name: 'Rohan Mehta',
        runs_scored: 0,
        balls_faced: 0,
        sixes: 0,
        wickets_taken: 1,
        overs_bowled: 3.4,
        runs_conceded: 15,
      },
    ]);

    expect(result[0].legalBallsBowled).toBe(49);
  });

  it('keeps separate players separate', () => {
    const result = aggregateByPlayer([
      {
        player_id: 'p1',
        bfam_id: 'BF1001',
        full_name: 'Asha Patel',
        runs_scored: 10,
        balls_faced: 10,
        sixes: 0,
        wickets_taken: 0,
        overs_bowled: 0,
        runs_conceded: 0,
      },
      {
        player_id: 'p2',
        bfam_id: 'BF1002',
        full_name: 'Rohan Mehta',
        runs_scored: 20,
        balls_faced: 15,
        sixes: 1,
        wickets_taken: 0,
        overs_bowled: 0,
        runs_conceded: 0,
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.player_id === 'p1')?.runs).toBe(10);
    expect(result.find((r) => r.player_id === 'p2')?.runs).toBe(20);
  });

  it('returns an empty array for no rows', () => {
    expect(aggregateByPlayer([])).toEqual([]);
  });
});
