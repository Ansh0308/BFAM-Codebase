// Long tail — Match Streaks (PRD §12.38): "tracks consecutive
// participation to encourage regular play" — current streak, best streak,
// consecutive participation. Pure date/week math, dependency-free so it's
// unit-testable directly (same split as domain/statistics.ts and
// domain/achievements.ts).
//
// This is deliberately a DIFFERENT metric from Achievements & Badges'
// MATCH_STREAK badge (consecutive WINS) — PRD §12.38 is about
// consecutive PARTICIPATION (playing regularly), not winning. The two
// happen to share the word "streak" but count different things.
//
// Scoping decision (no founder available — see RESUME_STATE.md):
// "participation" is measured per calendar week (Monday-Sunday, UTC) —
// playing any number of completed matches within a week counts as
// participating that week; missing a week breaks the streak. Weekly is
// the natural cadence for casual box-cricket play (PRD's own examples are
// weekly-cadence activities elsewhere, e.g. "monthly loyalty" for coins
// implies weekly/monthly are the app's granularities, not daily). "Streak
// rewards and bonuses" (also named in §12.38, and "maintaining streaks"
// in §12.34's coin-earning list) is deliberately NOT implemented here —
// granting a one-time reward at a streak milestone needs its own
// idempotency record (to avoid re-granting every time this is queried)
// and undefined reward amounts; this first cut is tracking/display only.

function computeWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day + 6) % 7; // Monday = 0 days back
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d;
}

function weeksBetween(earlier: Date, later: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export interface MatchStreaks {
  current_streak: number;
  best_streak: number;
  participated_week_starts: string[]; // ISO 'YYYY-MM-DD' (Monday of each week), ascending
}

export function computeMatchStreaks(matchDates: Date[], now: Date = new Date()): MatchStreaks {
  const weekStarts = [
    ...new Set(matchDates.map((d) => computeWeekStart(d).toISOString().slice(0, 10))),
  ].sort();

  let bestStreak = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const weekStart of weekStarts) {
    const current = new Date(`${weekStart}T00:00:00Z`);
    run = previous && weeksBetween(previous, current) === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = current;
  }

  let currentStreak = 0;
  if (weekStarts.length > 0) {
    const currentWeekStart = computeWeekStart(now);
    const lastParticipatedWeek = new Date(`${weekStarts[weekStarts.length - 1]}T00:00:00Z`);
    // Still "alive" if the player participated this week or last week — a
    // streak isn't broken just because this week isn't over yet.
    if (weeksBetween(lastParticipatedWeek, currentWeekStart) <= 1) {
      currentStreak = 1;
      for (let i = weekStarts.length - 1; i > 0; i -= 1) {
        const a = new Date(`${weekStarts[i - 1]}T00:00:00Z`);
        const b = new Date(`${weekStarts[i]}T00:00:00Z`);
        if (weeksBetween(a, b) === 1) currentStreak += 1;
        else break;
      }
    }
  }

  return {
    current_streak: currentStreak,
    best_streak: bestStreak,
    participated_week_starts: weekStarts,
  };
}
