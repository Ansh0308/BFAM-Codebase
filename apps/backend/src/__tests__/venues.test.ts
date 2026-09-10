// Exercises the owner-facing venue endpoints (feedback backlog A-2): an
// owner grouping more than one pitch at the same physical location. Each
// pitch under a venue stays its own independently bookable turf — venues
// are purely a display/address-grouping layer over the existing turfs
// table. Only the low-level `sequelize` module is faked (no real MySQL in
// this test environment), same pattern as turfs.test.ts.

interface VenueRow {
  venue_id: string;
  owner_id: string;
  venue_name: string;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface TurfRow {
  turf_id: string;
  owner_id: string;
  venue_id: string | null;
  turf_name: string;
  description: string | null;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  ball_types_supported: string;
  stadium_sound_enabled: boolean;
  turf_status: string;
  average_rating: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

let venues: VenueRow[] = [];
let turfs: TurfRow[] = [];

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('FROM venues WHERE venue_id')) {
          const v = venues.find((x) => x.venue_id === r.venueId && x.deleted_at === null);
          return v ? [v] : [];
        }

        if (sql.includes('FROM venues v')) {
          return venues
            .filter((v) => v.owner_id === r.ownerUserId && v.deleted_at === null)
            .map((v) => ({
              ...v,
              pitch_count: turfs.filter((t) => t.venue_id === v.venue_id && t.deleted_at === null)
                .length,
            }));
        }

        if (sql.includes('FROM turfs WHERE venue_id')) {
          return turfs.filter((t) => t.venue_id === r.venueId && t.deleted_at === null);
        }

        if (sql.includes('SELECT turf_id FROM turfs WHERE turf_id')) {
          const t = turfs.find((x) => x.turf_id === r.turfId && x.turf_status === 'ACTIVE');
          return t ? [{ turf_id: t.turf_id }] : [];
        }

        if (sql.includes('SELECT turf_id, owner_id, venue_id FROM turfs')) {
          const t = turfs.find((x) => x.turf_id === r.turfId && x.deleted_at === null);
          return t ? [{ turf_id: t.turf_id, owner_id: t.owner_id, venue_id: t.venue_id }] : [];
        }

        if (sql.includes('t.turf_id != :turfId')) {
          // Sibling pitches at the same venue (turfService.getTurfDetails).
          return turfs
            .filter(
              (t) => t.venue_id === r.venueId && t.turf_id !== r.turfId && t.deleted_at === null,
            )
            .map((t) => ({
              turf_id: t.turf_id,
              turf_name: t.turf_name,
              min_price_per_hour: null,
            }));
        }

        if (sql.includes('t.venue_id = :venueId') && sql.includes("t.turf_status = 'ACTIVE'")) {
          // Player-facing venue pitch-picker (turfService.getVenueForPlayer).
          return turfs
            .filter(
              (t) =>
                t.venue_id === r.venueId && t.turf_status === 'ACTIVE' && t.deleted_at === null,
            )
            .sort((a, b) => a.turf_name.localeCompare(b.turf_name))
            .map((t) => ({
              turf_id: t.turf_id,
              turf_name: t.turf_name,
              cover_image_url: null,
              min_price_per_hour: null,
            }));
        }

        if (sql.includes('FROM turfs t') && sql.includes('WHERE t.turf_id')) {
          const t = turfs.find((x) => x.turf_id === r.turfId);
          if (!t) return [];
          const v = venues.find((x) => x.venue_id === t.venue_id);
          return [{ ...t, venue_name: v ? v.venue_name : null }];
        }

        if (sql.includes('FROM turfs t') && sql.includes('WHERE t.owner_id')) {
          return turfs
            .filter((t) => t.owner_id === r.ownerUserId && t.deleted_at === null)
            .map((t) => {
              const v = venues.find((x) => x.venue_id === t.venue_id);
              return { ...t, venue_name: v ? v.venue_name : null };
            });
        }

        if (
          sql.includes('FROM turf_images') ||
          sql.includes('FROM turf_facilities') ||
          sql.includes('FROM turf_operating_hours') ||
          sql.includes('FROM turf_pricing') ||
          sql.includes('FROM turf_availability_blocks') ||
          (sql.includes('FROM bookings') && sql.includes('booking_status'))
        ) {
          return [];
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'venues') venues.push(...(rows as unknown as VenueRow[]));
          if (table === 'turfs') turfs.push(...(rows as unknown as TurfRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          const arr = (table === 'venues' ? venues : turfs) as unknown as Record<string, unknown>[];
          for (const row of arr) {
            if (matchesWhere(row, where)) Object.assign(row, values);
          }
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

const OWNER_ID = 'owner-1';
const OTHER_OWNER_ID = 'owner-2';

async function ownerToken(userId = OWNER_ID) {
  const res = await request(app)
    .post('/auth/dev-token')
    .send({ role: 'TURF_OWNER', user_id: userId });
  return res.body.token as string;
}

describe('Owner Venues (feedback backlog A-2)', () => {
  beforeEach(() => {
    venues = [];
    turfs = [];
  });

  it('creates a venue and returns it', async () => {
    const token = await ownerToken();
    const res = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });

    expect(res.status).toBe(201);
    expect(res.body.venue_name).toBe('Redline Sports Complex');
    expect(res.body.venue_id).toBeTruthy();
  });

  it('creating a venue with pitch_count creates the venue and every auto-named pitch in one step', async () => {
    const token = await ownerToken();
    const res = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
        pitch_count: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.turfs).toHaveLength(3);
    const names = res.body.turfs.map((t: { turf_name: string }) => t.turf_name).sort();
    expect(names).toEqual(['Pitch 1', 'Pitch 2', 'Pitch 3']);
    for (const t of res.body.turfs) {
      expect(t.address_line).toBe('Ring Road');
      expect(t.venue_id).toBe(res.body.venue_id);
    }
  });

  it('rejects a pitch_count outside the allowed range', async () => {
    const token = await ownerToken();
    const res = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
        pitch_count: 0,
      });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid venue payload', async () => {
    const token = await ownerToken();
    const res = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({ venue_name: 'X' });
    expect(res.status).toBe(400);
  });

  it('creating a turf under a venue auto-fills its address from the venue', async () => {
    const token = await ownerToken();
    const venueRes = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });
    const venueId = venueRes.body.venue_id;

    const turfRes = await request(app)
      .post('/owner/turfs')
      .set('Authorization', `Bearer ${token}`)
      .send({ turf_name: 'Pitch 1', venue_id: venueId });

    expect(turfRes.status).toBe(201);
    expect(turfRes.body.address_line).toBe('Ring Road');
    expect(turfRes.body.city).toBe('Rajkot');
    expect(turfRes.body.venue_id).toBe(venueId);
    expect(turfRes.body.venue_name).toBe('Redline Sports Complex');
  });

  it('rejects a standalone turf (no venue_id) with no address fields', async () => {
    const token = await ownerToken();
    const res = await request(app)
      .post('/owner/turfs')
      .set('Authorization', `Bearer ${token}`)
      .send({ turf_name: 'Solo Turf' });
    expect(res.status).toBe(400);
  });

  it('still creates a standalone turf when address fields are given', async () => {
    const token = await ownerToken();
    const res = await request(app)
      .post('/owner/turfs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        turf_name: 'Solo Turf',
        address_line: 'MG Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });
    expect(res.status).toBe(201);
    expect(res.body.venue_id).toBeNull();
  });

  it('lists sibling pitches on the player-facing turf details when a venue is shared', async () => {
    const token = await ownerToken();
    const venueRes = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });
    const venueId = venueRes.body.venue_id;

    await request(app)
      .post('/owner/turfs')
      .set('Authorization', `Bearer ${token}`)
      .send({ turf_name: 'Pitch 1', venue_id: venueId });
    const pitch2 = await request(app)
      .post('/owner/turfs')
      .set('Authorization', `Bearer ${token}`)
      .send({ turf_name: 'Pitch 2', venue_id: venueId });

    const playerToken = (await request(app).post('/auth/dev-token').send({ role: 'PLAYER' })).body
      .token;

    const detailsRes = await request(app)
      .get(`/turfs/${pitch2.body.turf_id}`)
      .set('Authorization', `Bearer ${playerToken}`);

    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.venue_name).toBe('Redline Sports Complex');
    expect(detailsRes.body.sibling_pitches).toHaveLength(1);
    expect(detailsRes.body.sibling_pitches[0].turf_name).toBe('Pitch 1');
  });

  it('editing a venue address cascades to every pitch under it', async () => {
    const token = await ownerToken();
    const venueRes = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });
    const venueId = venueRes.body.venue_id;

    const pitch1 = await request(app)
      .post('/owner/turfs')
      .set('Authorization', `Bearer ${token}`)
      .send({ turf_name: 'Pitch 1', venue_id: venueId });

    const updateRes = await request(app)
      .patch(`/owner/venues/${venueId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ address_line: 'New Ring Road' });

    expect(updateRes.status).toBe(200);
    const updatedPitch = turfs.find((t) => t.turf_id === pitch1.body.turf_id);
    expect(updatedPitch?.address_line).toBe('New Ring Road');
  });

  it('retroactively assigns an existing standalone turf to a venue', async () => {
    const token = await ownerToken();
    const standaloneRes = await request(app)
      .post('/owner/turfs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        turf_name: 'Solo Turf',
        address_line: 'MG Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });
    const venueRes = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });

    const assignRes = await request(app)
      .post(`/owner/turfs/${standaloneRes.body.turf_id}/venue`)
      .set('Authorization', `Bearer ${token}`)
      .send({ venue_id: venueRes.body.venue_id });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.venue_id).toBe(venueRes.body.venue_id);
    expect(assignRes.body.address_line).toBe('Ring Road');
  });

  it('rejects editing the address of a turf that is locked to a venue', async () => {
    const token = await ownerToken();
    const venueRes = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });
    const pitch1 = await request(app)
      .post('/owner/turfs')
      .set('Authorization', `Bearer ${token}`)
      .send({ turf_name: 'Pitch 1', venue_id: venueRes.body.venue_id });

    const res = await request(app)
      .patch(`/owner/turfs/${pitch1.body.turf_id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ address_line: 'Somewhere else' });

    expect(res.status).toBe(403);
  });

  it('403s when acting on another owner’s venue', async () => {
    const ownerA = await ownerToken(OWNER_ID);
    const ownerB = await ownerToken(OTHER_OWNER_ID);

    const venueRes = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${ownerA}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });

    const res = await request(app)
      .get(`/owner/venues/${venueRes.body.venue_id}`)
      .set('Authorization', `Bearer ${ownerB}`);

    expect(res.status).toBe(403);
  });

  it('404s for an unknown venue_id', async () => {
    const token = await ownerToken();
    const res = await request(app)
      .get('/owner/venues/00000000-0000-4000-8000-000000000099')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Player-facing venue pitch picker (GET /venues/:venueId)', () => {
  beforeEach(() => {
    venues = [];
    turfs = [];
  });

  async function playerToken() {
    const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER' });
    return res.body.token as string;
  }

  it('lists every active pitch at the venue for a player to pick from', async () => {
    const ownerT = await ownerToken();
    const venueRes = await request(app)
      .post('/owner/venues')
      .set('Authorization', `Bearer ${ownerT}`)
      .send({
        venue_name: 'Redline Sports Complex',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
        pitch_count: 2,
      });

    const playerT = await playerToken();
    const res = await request(app)
      .get(`/venues/${venueRes.body.venue_id}`)
      .set('Authorization', `Bearer ${playerT}`);

    expect(res.status).toBe(200);
    expect(res.body.venue_name).toBe('Redline Sports Complex');
    expect(res.body.turfs).toHaveLength(2);
    expect(res.body.turfs.map((t: { turf_name: string }) => t.turf_name)).toEqual([
      'Pitch 1',
      'Pitch 2',
    ]);
  });

  it('404s for an unknown venue', async () => {
    const playerT = await playerToken();
    const res = await request(app)
      .get('/venues/00000000-0000-4000-8000-000000000099')
      .set('Authorization', `Bearer ${playerT}`);
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/venues/00000000-0000-4000-8000-000000000099');
    expect(res.status).toBe(401);
  });
});
