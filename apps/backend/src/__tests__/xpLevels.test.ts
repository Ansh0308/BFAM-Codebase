// Pure unit tests for xpService.ts's computeLevelProgress — the XP-total
// -> level/progress math, independently testable without a database (long
// tail — XP & Player Levels, PRD §12.35).

import { computeLevelProgress, LEVEL_THRESHOLDS } from '../services/xpService';

describe('computeLevelProgress (long tail — XP & Player Levels)', () => {
  it('starts at Newbie for 0 XP', () => {
    expect(computeLevelProgress(0)).toMatchObject({
      level: 'Newbie',
      xp_into_level: 0,
      next_level: 'Rookie',
    });
  });

  it('advances to the next level exactly at its threshold', () => {
    const atThreshold = LEVEL_THRESHOLDS.find((l) => l.level === 'Rookie')!.minXp;
    expect(computeLevelProgress(atThreshold).level).toBe('Rookie');
    expect(computeLevelProgress(atThreshold - 1).level).toBe('Newbie');
  });

  it('computes progress percent toward the next level', () => {
    // Rookie starts at 100, Player at 300 -> 200 XP wide. 50 XP into it is 25%.
    const progress = computeLevelProgress(150);
    expect(progress.level).toBe('Rookie');
    expect(progress.xp_into_level).toBe(50);
    expect(progress.xp_for_next_level).toBe(200);
    expect(progress.progress_percent).toBe(25);
  });

  it('reports 100% progress and no next level at the top level (Legend)', () => {
    const progress = computeLevelProgress(10000);
    expect(progress.level).toBe('Legend');
    expect(progress.next_level).toBeNull();
    expect(progress.xp_for_next_level).toBeNull();
    expect(progress.progress_percent).toBe(100);
  });

  it('never exceeds 100% progress even mid-level rounding', () => {
    const justBelowNext = LEVEL_THRESHOLDS.find((l) => l.level === 'Player')!.minXp - 1;
    expect(computeLevelProgress(justBelowNext).progress_percent).toBeLessThanOrEqual(100);
  });
});
