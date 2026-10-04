import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Creates ONE admin account — nothing else. For a database that already has
// data (so the phase-1 / demo / beta seeds can't be re-run) but no way into
// Admin Web.
//
//   ADMIN_PHONE      required, e.g. +919000000099 (must not already be used)
//   ADMIN_EMAIL      optional
//   ADMIN_PASSWORD   optional — if omitted a random one is generated and
//                    printed once
//
//   ADMIN_PHONE=+919000000099 npm run db:create-admin --workspace=apps/backend
//
// Refuses to run if the phone (or email) already belongs to an account, so it
// can never overwrite someone's login.
async function main() {
  const phone = (process.env.ADMIN_PHONE ?? '').trim();
  const email = (process.env.ADMIN_EMAIL ?? '').trim() || null;
  if (!phone) {
    console.error('Set ADMIN_PHONE (e.g. +919000000099) and run again.');
    process.exit(1);
  }

  await sequelize.authenticate();

  const clash = await sequelize.query<{ user_id: string }>(
    'SELECT user_id FROM users WHERE phone_number = :phone OR (:email IS NOT NULL AND email = :email)',
    { type: QueryTypes.SELECT, replacements: { phone, email } },
  );
  if (clash.length > 0) {
    console.error(`An account already uses ${phone}${email ? ` / ${email}` : ''}. Pick another.`);
    await sequelize.close();
    process.exit(1);
  }

  const supplied = (process.env.ADMIN_PASSWORD ?? '').trim();
  const password = supplied || randomBytes(12).toString('base64url');
  const now = new Date();

  await sequelize.getQueryInterface().bulkInsert('users', [
    {
      user_id: randomUUID(),
      phone_number: phone,
      email,
      password_hash: await bcrypt.hash(password, 10),
      role: 'ADMIN',
      account_status: 'ACTIVE',
      phone_verified_at: now,
      profile_photo_url: null,
      city: null,
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
    },
  ]);

  console.log('Admin created.');
  console.log(`  Sign in at the web login with: ${phone}`);
  console.log(
    supplied
      ? '  Password: the ADMIN_PASSWORD you supplied'
      : `  Password: ${password}  (shown once — save it)`,
  );
  await sequelize.close();
}

main().catch((error) => {
  console.error('Could not create the admin:', error);
  process.exit(1);
});
