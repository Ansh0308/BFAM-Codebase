// Pure unit tests for domain/achievements.ts (long tail — Achievements &
// Badges, PRD §12.37). No database involved.

import {
  evaluateAchievements,
  computeBestWinStreak,
  hasHatTrick,
  ACHIEVEMENT_DEFINITIONS,
} from '../domain/achievements';

function baseInput() {
  return {
    matchesPlayed: 0,
    bestScore: null,
    careerSixes: 0,
    potmCount: 0,
    bestWinStreak: 0,
    hasHatTrick: false,
    fairPlayRating: 80,
    reliabilityScore: 80,
    isLegendLevel: false,
  };
}

describe('evaluateAchievements (long tail — Achievements & Badges)', () => {
  it('returns every defined achievement, unearned by default', () => {
    const results = evaluateAchievements(baseInput());
    expect(results).toHaveLength(ACHIEVEMENT_DEFINITIONS.length);
    expect(results.every((r) => !r.earned)).toBe(true);
  });

  it('earns FIRST_MATCH after one completed match', () => {
    const results = evaluateAchievements({ ...baseInput(), matchesPlayed: 1 });
    expect(results.find((r) => r.id === 'FIRST_MATCH')?.earned).toBe(true);
  });

  it('earns CENTURY_CLUB at exactly 100 runs, not 99', () => {
    expect(
      evaluateAchievements({ ...baseInput(), bestScore: 99 }).find((r) => r.id === 'CENTURY_CLUB')
        ?.earned,
    ).toBe(false);
    expect(
      evaluateAchievements({ ...baseInput(), bestScore: 100 }).find((r) => r.id === 'CENTURY_CLUB')
        ?.earned,
    ).toBe(true);
  });

  it('earns SIX_MACHINE at the career-sixes threshold', () => {
    expect(
      evaluateAchievements({ ...baseInput(), careerSixes: 24 }).find((r) => r.id === 'SIX_MACHINE')
        ?.earned,
    ).toBe(false);
    expect(
      evaluateAchievements({ ...baseInput(), careerSixes: 25 }).find((r) => r.id === 'SIX_MACHINE')
        ?.earned,
    ).toBe(true);
  });

  it('earns HAT_TRICK_HERO only when hasHatTrick is true', () => {
    expect(
      evaluateAchievements({ ...baseInput(), hasHatTrick: true }).find(
        (r) => r.id === 'HAT_TRICK_HERO',
      )?.earned,
    ).toBe(true);
  });

  it('earns MATCH_STREAK at 3+ consecutive wins', () => {
    expect(
      evaluateAchievements({ ...baseInput(), bestWinStreak: 2 }).find(
        (r) => r.id === 'MATCH_STREAK',
      )?.earned,
    ).toBe(false);
    expect(
      evaluateAchievements({ ...baseInput(), bestWinStreak: 3 }).find(
        (r) => r.id === 'MATCH_STREAK',
      )?.earned,
    ).toBe(true);
  });

  it('earns BFAM_LEGEND only at the Legend XP level', () => {
    expect(
      evaluateAchievements({ ...baseInput(), isLegendLevel: true }).find(
        (r) => r.id === 'BFAM_LEGEND',
      )?.earned,
    ).toBe(true);
  });

  it('earns FAIR_PLAY_CHAMPION and RELIABLE_PLAYER at their rating thresholds', () => {
    expect(
      evaluateAchievements({ ...baseInput(), fairPlayRating: 95 }).find(
        (r) => r.id === 'FAIR_PLAY_CHAMPION',
      )?.earned,
    ).toBe(true);
    expect(
      evaluateAchievements({ ...baseInput(), reliabilityScore: 95 }).find(
        (r) => r.id === 'RELIABLE_PLAYER',
      )?.earned,
    ).toBe(true);
  });

  it('earns TOP_PERFORMER after a single Player of the Match award', () => {
    expect(
      evaluateAchievements({ ...baseInput(), potmCount: 1 }).find((r) => r.id === 'TOP_PERFORMER')
        ?.earned,
    ).toBe(true);
  });
});

describe('computeBestWinStreak', () => {
  it('finds the longest run of wins, not just the most recent streak', () => {
    // W W W L W W -> best streak is 3, even though the trailing streak is 2.
    const matches = [true, true, true, false, true, true].map((teamWon) => ({ teamWon }));
    expect(computeBestWinStreak(matches)).toBe(3);
  });

  it('treats a null result (no-result/bye) as breaking the streak, same as a loss', () => {
    const matches = [true, true, null, true].map((teamWon) => ({ teamWon }));
    expect(computeBestWinStreak(matches)).toBe(2);
  });

  it('returns 0 for no matches or no wins', () => {
    expect(computeBestWinStreak([])).toBe(0);
    expect(computeBestWinStreak([{ teamWon: false }, { teamWon: null }])).toBe(0);
  });
});

describe('hasHatTrick', () => {
  it('detects 3 consecutive wicket-taking deliveries by the same bowler', () => {
    const deliveries = [
      { matchId: 'm1', inningsId: 'i1', sequenceNumber: 10, isWicketForBowler: true },
      { matchId: 'm1', inningsId: 'i1', sequenceNumber: 16, isWicketForBowler: true },
      { matchId: 'm1', inningsId: 'i1', sequenceNumber: 22, isWicketForBowler: true },
    ];
    expect(hasHatTrick(deliveries)).toBe(true);
  });

  it('does not count 2 wickets separated by a non-wicket delivery', () => {
    const deliveries = [
      { matchId: 'm1', inningsId: 'i1', sequenceNumber: 10, isWicketForBowler: true },
      { matchId: 'm1', inningsId: 'i1', sequenceNumber: 16, isWicketForBowler: false },
      { matchId: 'm1', inningsId: 'i1', sequenceNumber: 22, isWicketForBowler: true },
    ];
    expect(hasHatTrick(deliveries)).toBe(false);
  });

  it('does not count 2 wickets in one match plus 1 in a different match', () => {
    const deliveries = [
      { matchId: 'm1', inningsId: 'i1', sequenceNumber: 10, isWicketForBowler: true },
      { matchId: 'm1', inningsId: 'i1', sequenceNumber: 16, isWicketForBowler: true },
      { matchId: 'm2', inningsId: 'i2', sequenceNumber: 5, isWicketForBowler: true },
    ];
    expect(hasHatTrick(deliveries)).toBe(false);
  });

  it('returns false for no deliveries', () => {
    expect(hasHatTrick([])).toBe(false);
  });
});
