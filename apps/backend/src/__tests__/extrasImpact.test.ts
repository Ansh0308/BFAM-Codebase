import {
  computeExtrasImpact,
  estimateSecondsPerDelivery,
  sumExtrasImpact,
  DEFAULT_SECONDS_PER_DELIVERY,
} from '../domain/extrasImpact';

const T0 = new Date('2026-10-02T10:00:00Z').getTime();
const at = (seconds: number) => new Date(T0 + seconds * 1000);

describe('estimateSecondsPerDelivery', () => {
  it('averages the gaps between recorded deliveries', () => {
    expect(estimateSecondsPerDelivery([at(0), at(30), at(60), at(90), at(120)])).toBe(30);
  });

  it('ignores a break in play and a double tap', () => {
    // gaps: 30, 30, 600 (break), 2 (double tap), 30 -> only the 30s gaps count
    const times = [at(0), at(30), at(60), at(660), at(662), at(692)];
    expect(estimateSecondsPerDelivery(times)).toBe(30);
  });

  it('falls back to a default when there are too few deliveries to measure', () => {
    expect(estimateSecondsPerDelivery([at(0), at(30)])).toBe(DEFAULT_SECONDS_PER_DELIVERY);
    expect(estimateSecondsPerDelivery([])).toBe(DEFAULT_SECONDS_PER_DELIVERY);
  });

  it('keeps the estimate in a sane range', () => {
    expect(estimateSecondsPerDelivery([at(0), at(6), at(12), at(18), at(24)])).toBe(15);
    expect(estimateSecondsPerDelivery([at(0), at(170), at(340), at(510), at(680)])).toBe(90);
  });
});

describe('computeExtrasImpact', () => {
  it('counts wides and no-balls as bowled-again deliveries and prices them', () => {
    const events = [
      { extra_type: 'NONE', recorded_at: at(0) },
      { extra_type: 'WIDE', recorded_at: at(30) },
      { extra_type: 'NO_BALL', recorded_at: at(60) },
      { extra_type: 'WIDE', recorded_at: at(90) },
      { extra_type: 'BYE', recorded_at: at(120) },
      { extra_type: 'LEG_BYE', recorded_at: at(150) },
    ];
    expect(computeExtrasImpact(events)).toEqual({
      wides: 2,
      no_balls: 1,
      byes: 1,
      leg_byes: 1,
      rebowled_deliveries: 3,
      seconds_per_delivery: 30,
      estimated_seconds_lost: 90,
    });
  });

  it('byes and leg-byes are legal balls, so they cost no time', () => {
    const impact = computeExtrasImpact([
      { extra_type: 'BYE', recorded_at: at(0) },
      { extra_type: 'LEG_BYE', recorded_at: at(30) },
    ]);
    expect(impact.rebowled_deliveries).toBe(0);
    expect(impact.estimated_seconds_lost).toBe(0);
  });

  it('is all zeros for an innings with no extras', () => {
    const impact = computeExtrasImpact([{ extra_type: 'NONE', recorded_at: at(0) }]);
    expect(impact).toMatchObject({ wides: 0, no_balls: 0, rebowled_deliveries: 0 });
  });
});

describe('sumExtrasImpact', () => {
  it('adds innings together and averages the pace by what was lost', () => {
    const a = computeExtrasImpact([
      { extra_type: 'WIDE', recorded_at: at(0) },
      { extra_type: 'NONE', recorded_at: at(20) },
      { extra_type: 'NONE', recorded_at: at(40) },
      { extra_type: 'NONE', recorded_at: at(60) },
    ]);
    const b = computeExtrasImpact([{ extra_type: 'NO_BALL', recorded_at: at(0) }]);
    const total = sumExtrasImpact([a, b]);
    expect(total.rebowled_deliveries).toBe(2);
    expect(total.wides).toBe(1);
    expect(total.no_balls).toBe(1);
    expect(total.estimated_seconds_lost).toBe(20 + DEFAULT_SECONDS_PER_DELIVERY);
  });
});
