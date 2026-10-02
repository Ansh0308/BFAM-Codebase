// Extra-delivery impact: how much extra play (and so time) an innings spent on
// deliveries that had to be bowled again. A wide or a no-ball does not count as a
// legal ball, so the bowler delivers another one in its place — that is time the
// match spent without moving forward, time in which more balls could have been
// played. Byes and leg-byes are legal deliveries (the ball still counts), so they
// cost no extra time and are only counted.
//
// Nothing records how long each delivery took, so the time is an ESTIMATE: the
// innings' own average gap between recorded deliveries (pauses for a new batter or
// a drinks break are ignored), clamped to a sane range, or a default when there are
// too few deliveries to measure. The screens label it "about".

export const DEFAULT_SECONDS_PER_DELIVERY = 40;
const MIN_SECONDS = 15;
const MAX_SECONDS = 90;
// Gaps outside this window are not "a delivery": a few seconds is a double-tap,
// minutes is a break in play.
const MIN_GAP_SECONDS = 5;
const MAX_GAP_SECONDS = 180;
const MIN_SAMPLES = 3;

export interface ExtrasImpactInput {
  extra_type: string;
  recorded_at: Date | string;
}

export interface ExtrasImpact {
  wides: number;
  no_balls: number;
  byes: number;
  leg_byes: number;
  // wides + no-balls: deliveries bowled again.
  rebowled_deliveries: number;
  seconds_per_delivery: number;
  estimated_seconds_lost: number;
}

export function estimateSecondsPerDelivery(recordedAt: (Date | string)[]): number {
  const times = recordedAt.map((t) => new Date(t).getTime()).filter((t) => !Number.isNaN(t));
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    const seconds = (times[i] - times[i - 1]) / 1000;
    if (seconds >= MIN_GAP_SECONDS && seconds <= MAX_GAP_SECONDS) gaps.push(seconds);
  }
  if (gaps.length < MIN_SAMPLES) return DEFAULT_SECONDS_PER_DELIVERY;
  const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  return Math.round(Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, mean)));
}

// `events` must be in the order the deliveries were recorded.
export function computeExtrasImpact(events: ExtrasImpactInput[]): ExtrasImpact {
  const count = (type: string) => events.filter((e) => e.extra_type === type).length;
  const wides = count('WIDE');
  const noBalls = count('NO_BALL');
  const rebowled = wides + noBalls;
  const secondsPerDelivery = estimateSecondsPerDelivery(events.map((e) => e.recorded_at));
  return {
    wides,
    no_balls: noBalls,
    byes: count('BYE'),
    leg_byes: count('LEG_BYE'),
    rebowled_deliveries: rebowled,
    seconds_per_delivery: secondsPerDelivery,
    estimated_seconds_lost: rebowled * secondsPerDelivery,
  };
}

export function sumExtrasImpact(impacts: ExtrasImpact[]): ExtrasImpact {
  const total = impacts.reduce(
    (acc, i) => ({
      wides: acc.wides + i.wides,
      no_balls: acc.no_balls + i.no_balls,
      byes: acc.byes + i.byes,
      leg_byes: acc.leg_byes + i.leg_byes,
      rebowled_deliveries: acc.rebowled_deliveries + i.rebowled_deliveries,
      estimated_seconds_lost: acc.estimated_seconds_lost + i.estimated_seconds_lost,
    }),
    {
      wides: 0,
      no_balls: 0,
      byes: 0,
      leg_byes: 0,
      rebowled_deliveries: 0,
      estimated_seconds_lost: 0,
    },
  );
  const seconds =
    total.rebowled_deliveries > 0
      ? Math.round(total.estimated_seconds_lost / total.rebowled_deliveries)
      : DEFAULT_SECONDS_PER_DELIVERY;
  return { ...total, seconds_per_delivery: seconds };
}
