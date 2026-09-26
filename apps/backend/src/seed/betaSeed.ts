import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Beta seed — the minimum a FRESH cloud database needs before testers arrive:
// one admin, one turf owner, and two bookable turfs. Unlike phase1Seed /
// demoSeed (fake players, matches, and passwords that are printed in the repo)
// it creates no fake activity and NO account with a known password: each
// password comes from the environment or is generated randomly and printed once.
//
//   BETA_ADMIN_PHONE / BETA_ADMIN_EMAIL / BETA_ADMIN_PASSWORD
//   BETA_OWNER_PHONE / BETA_OWNER_EMAIL / BETA_OWNER_PASSWORD
//   BETA_CITY            city for the sample turfs (default "Rajkot")
//
// Safe to re-run: it does nothing if the admin phone already exists.
export interface BetaSeedInput {
  now: Date;
  passwordHash: { admin: string; owner: string };
  admin: { phone: string; email: string };
  owner: { phone: string; email: string };
  city: string;
}

const TURFS = [
  { name: 'Green Park Box Cricket', lat: 22.303894, lng: 70.802162 },
  { name: 'Night Shot Cricket', lat: 22.310894, lng: 70.808162 },
];

export function buildBetaSeedRows(input: BetaSeedInput) {
  const { now } = input;
  const base = {
    account_status: 'ACTIVE',
    phone_verified_at: now,
    profile_photo_url: null,
    city: input.city,
    preferred_language: 'en',
    // Only PLAYER accounts carry a BFAM ID (PRD §12.59).
    bfam_id: null,
    google_id: null,
    apple_id: null,
    is_minor: false,
    last_login_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const adminUserId = randomUUID();
  const ownerUserId = randomUUID();
  const users = [
    {
      ...base,
      user_id: adminUserId,
      phone_number: input.admin.phone,
      email: input.admin.email,
      password_hash: input.passwordHash.admin,
      role: 'ADMIN',
    },
    {
      ...base,
      user_id: ownerUserId,
      phone_number: input.owner.phone,
      email: input.owner.email,
      password_hash: input.passwordHash.owner,
      role: 'TURF_OWNER',
    },
  ];

  const turfs = TURFS.map((t, i) => ({
    turf_id: randomUUID(),
    owner_id: ownerUserId,
    turf_name: t.name,
    description: 'Box cricket turf with floodlights.',
    address_line: `Sample address ${i + 1}`,
    city: input.city,
    latitude: t.lat,
    longitude: t.lng,
    ball_types_supported: JSON.stringify(['TENNIS', 'HARD_TENNIS']),
    stadium_sound_enabled: true,
    turf_status: 'ACTIVE',
    average_rating: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }));

  const pricing = turfs.flatMap((turf) =>
    (
      [
        ['WEEKDAY', 800],
        ['WEEKEND', 1200],
      ] as const
    ).map(([dayType, price]) => ({
      pricing_id: randomUUID(),
      turf_id: turf.turf_id,
      day_type: dayType,
      start_time: '06:00:00',
      end_time: '23:00:00',
      price_per_hour: price,
      currency: 'INR',
      effective_from: '2026-01-01',
      effective_to: null,
    })),
  );

  // Open every day, 06:00–23:00 (day_of_week 0 = Sunday).
  const hours = turfs.flatMap((turf) =>
    [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      hours_id: randomUUID(),
      turf_id: turf.turf_id,
      day_of_week: day,
      open_time: '06:00:00',
      close_time: '23:00:00',
    })),
  );

  const facilities = turfs.map((turf) => ({
    facility_id: randomUUID(),
    turf_id: turf.turf_id,
    facility_name: 'FLOODLIGHTS',
  }));

  return { users, turfs, pricing, hours, facilities };
}

function requiredOrDefault(name: string, fallback: string): string {
  return (process.env[name] ?? '').trim() || fallback;
}

// A password from the environment, or a random one that must be shown once.
function resolvePassword(name: string): { password: string; generated: boolean } {
  const fromEnv = (process.env[name] ?? '').trim();
  if (fromEnv) return { password: fromEnv, generated: false };
  return { password: randomBytes(12).toString('base64url'), generated: true };
}

async function insert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  await sequelize.getQueryInterface().bulkInsert(table, rows);
}

async function main() {
  await sequelize.authenticate();

  const adminPhone = requiredOrDefault('BETA_ADMIN_PHONE', '+919000000001');
  const ownerPhone = requiredOrDefault('BETA_OWNER_PHONE', '+919000000002');

  const existing = await sequelize.query<{ user_id: string }>(
    'SELECT user_id FROM users WHERE phone_number = :phone',
    { type: QueryTypes.SELECT, replacements: { phone: adminPhone } },
  );
  if (existing.length > 0) {
    console.log(`Beta seed skipped: an account for ${adminPhone} already exists.`);
    await sequelize.close();
    return;
  }

  const adminPassword = resolvePassword('BETA_ADMIN_PASSWORD');
  const ownerPassword = resolvePassword('BETA_OWNER_PASSWORD');
  const rows = buildBetaSeedRows({
    now: new Date(),
    passwordHash: {
      admin: await bcrypt.hash(adminPassword.password, 10),
      owner: await bcrypt.hash(ownerPassword.password, 10),
    },
    admin: { phone: adminPhone, email: requiredOrDefault('BETA_ADMIN_EMAIL', 'admin@bfam.local') },
    owner: { phone: ownerPhone, email: requiredOrDefault('BETA_OWNER_EMAIL', 'owner@bfam.local') },
    city: requiredOrDefault('BETA_CITY', 'Rajkot'),
  });

  await sequelize.transaction(async () => {
    await insert('users', rows.users);
    await insert('turfs', rows.turfs);
    await insert('turf_pricing', rows.pricing);
    await insert('turf_operating_hours', rows.hours);
    await insert('turf_facilities', rows.facilities);
  });

  console.log('Beta seed complete.');
  console.log(
    `  Admin  (web login): ${adminPhone}${adminPassword.generated ? `  password: ${adminPassword.password}` : '  (password from BETA_ADMIN_PASSWORD)'}`,
  );
  console.log(
    `  Owner  (web login): ${ownerPhone}${ownerPassword.generated ? `  password: ${ownerPassword.password}` : '  (password from BETA_OWNER_PASSWORD)'}`,
  );
  if (adminPassword.generated || ownerPassword.generated) {
    console.log('  Generated passwords are shown ONCE — save them now.');
  }
  await sequelize.close();
}

// Run only when executed directly (the tests import buildBetaSeedRows).
if (require.main === module) {
  main().catch((error) => {
    console.error('Beta seed failed:', error);
    process.exit(1);
  });
}
