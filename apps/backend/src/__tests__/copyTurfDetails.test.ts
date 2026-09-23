// Backlog A-14: copying a pitch's pricing/operating-hours/description/
// ball-types/sound-setting onto another pitch — a real gap for a
// multi-pitch venue (A-2), where adding a 3rd/4th pitch otherwise means
// re-entering identical configuration by hand.

interface TurfRow {
  turf_id: string;
  owner_id: string;
  venue_id: string | null;
  turf_name: string;
  description: string | null;
  ball_types_supported: string[];
  stadium_sound_enabled: boolean;
}
interface PricingRow {
  pricing_id: string;
  turf_id: string;
  day_type: string;
  start_time: string;
  end_time: string;
  price_per_hour: number;
}
interface HoursRow {
  hours_id: string;
  turf_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
}

const OWNER = 'owner-1';
const OTHER_OWNER = 'owner-2';
const SOURCE_TURF = 'turf-source';
const TARGET_TURF = 'turf-target';

let turfs: TurfRow[] = [];
let pricing: PricingRow[] = [];
let hours: HoursRow[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('SELECT turf_id, owner_id, venue_id FROM turfs WHERE turf_id')) {
          const t = turfs.find((x) => x.turf_id === r.turfId);
          return t ? [t] : [];
        }
        if (
          sql.includes('SELECT description, ball_types_supported, stadium_sound_enabled FROM turfs')
        ) {
          const t = turfs.find((x) => x.turf_id === r.turfId);
          return t ? [t] : [];
        }
        if (sql.includes('SELECT t.*, v.venue_name FROM turfs t')) {
          const t = turfs.find((x) => x.turf_id === r.turfId);
          return t ? [{ ...t, venue_name: null }] : [];
        }
        if (sql.includes('FROM turf_pricing WHERE turf_id')) {
          return pricing.filter((p) => p.turf_id === r.turfId);
        }
        if (sql.includes('FROM turf_operating_hours WHERE turf_id')) {
          return hours.filter((h) => h.turf_id === r.turfId);
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'turfs') {
            const t = turfs.find((x) => x.turf_id === where.turf_id);
            if (!t) return;
            if ('description' in values) t.description = values.description as string | null;
            if ('ball_types_supported' in values) {
              t.ball_types_supported = JSON.parse(values.ball_types_supported as string);
            }
            if ('stadium_sound_enabled' in values) {
              t.stadium_sound_enabled = values.stadium_sound_enabled as boolean;
            }
          }
        },
        bulkDelete: async (table: string, where: Record<string, unknown>) => {
          if (table === 'turf_pricing')
            pricing = pricing.filter((p) => p.turf_id !== where.turf_id);
          if (table === 'turf_operating_hours') {
            hours = hours.filter((h) => h.turf_id !== where.turf_id);
          }
        },
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'turf_pricing') pricing.push(...(rows as unknown as PricingRow[]));
          if (table === 'turf_operating_hours') hours.push(...(rows as unknown as HoursRow[]));
        },
      }),
    },
  };
});

import { copyTurfDetails } from '../services/ownerService';

describe("copyTurfDetails (backlog A-14: copy a pitch's details onto another)", () => {
  beforeEach(() => {
    turfs = [
      {
        turf_id: SOURCE_TURF,
        owner_id: OWNER,
        venue_id: 'venue-1',
        turf_name: 'Pitch A',
        description: 'Full-size turf with floodlights',
        ball_types_supported: ['TENNIS', 'HARD_TENNIS'],
        stadium_sound_enabled: true,
      },
      {
        turf_id: TARGET_TURF,
        owner_id: OWNER,
        venue_id: 'venue-1',
        turf_name: 'Pitch B',
        description: null,
        ball_types_supported: [],
        stadium_sound_enabled: false,
      },
    ];
    pricing = [
      {
        pricing_id: 'p1',
        turf_id: SOURCE_TURF,
        day_type: 'WEEKDAY',
        start_time: '06:00:00',
        end_time: '22:00:00',
        price_per_hour: 800,
      },
    ];
    hours = [
      {
        hours_id: 'h1',
        turf_id: SOURCE_TURF,
        day_of_week: 1,
        open_time: '06:00:00',
        close_time: '23:00:00',
      },
    ];
  });

  it("copies the source pitch's description, ball types, and sound setting onto the target", async () => {
    await copyTurfDetails(TARGET_TURF, SOURCE_TURF, OWNER);

    const target = turfs.find((t) => t.turf_id === TARGET_TURF)!;
    expect(target.description).toBe('Full-size turf with floodlights');
    expect(target.ball_types_supported).toEqual(['TENNIS', 'HARD_TENNIS']);
    expect(target.stadium_sound_enabled).toBe(true);
  });

  it('copies pricing rows onto the target pitch, replacing whatever it had', async () => {
    pricing.push({
      pricing_id: 'p-old',
      turf_id: TARGET_TURF,
      day_type: 'WEEKEND',
      start_time: '08:00:00',
      end_time: '20:00:00',
      price_per_hour: 500,
    });

    await copyTurfDetails(TARGET_TURF, SOURCE_TURF, OWNER);

    const targetPricing = pricing.filter((p) => p.turf_id === TARGET_TURF);
    expect(targetPricing).toHaveLength(1);
    expect(targetPricing[0]).toMatchObject({ day_type: 'WEEKDAY', price_per_hour: 800 });
  });

  it('copies operating hours rows onto the target pitch', async () => {
    await copyTurfDetails(TARGET_TURF, SOURCE_TURF, OWNER);

    const targetHours = hours.filter((h) => h.turf_id === TARGET_TURF);
    expect(targetHours).toHaveLength(1);
    expect(targetHours[0]).toMatchObject({ day_of_week: 1, open_time: '06:00:00' });
  });

  it('never touches the source pitch', async () => {
    await copyTurfDetails(TARGET_TURF, SOURCE_TURF, OWNER);

    const source = turfs.find((t) => t.turf_id === SOURCE_TURF)!;
    expect(source.description).toBe('Full-size turf with floodlights');
    expect(pricing.filter((p) => p.turf_id === SOURCE_TURF)).toHaveLength(1);
  });

  it('rejects copying a pitch onto itself', async () => {
    await expect(copyTurfDetails(SOURCE_TURF, SOURCE_TURF, OWNER)).rejects.toThrow(
      'Choose a different pitch to copy details from.',
    );
  });

  it("rejects a caller who doesn't own the target pitch", async () => {
    await expect(copyTurfDetails(TARGET_TURF, SOURCE_TURF, OTHER_OWNER)).rejects.toThrow();
  });

  it("rejects a caller who doesn't own the source pitch", async () => {
    turfs.push({
      turf_id: 'turf-not-mine',
      owner_id: OTHER_OWNER,
      venue_id: null,
      turf_name: 'Someone Else’s Pitch',
      description: 'x',
      ball_types_supported: [],
      stadium_sound_enabled: true,
    });

    await expect(copyTurfDetails(TARGET_TURF, 'turf-not-mine', OWNER)).rejects.toThrow();
  });
});
