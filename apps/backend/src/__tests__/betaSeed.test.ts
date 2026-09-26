// The beta seed must give a fresh cloud database the bare minimum to demo the
// product, and must never create an account with a password anyone can read in
// the repo.

jest.mock('../config/sequelize', () => ({ sequelize: {} }));

import { buildBetaSeedRows } from '../seed/betaSeed';
import * as fs from 'fs';
import * as path from 'path';

const input = {
  now: new Date('2026-09-26T00:00:00Z'),
  passwordHash: { admin: 'hash-admin', owner: 'hash-owner' },
  admin: { phone: '+919000000001', email: 'admin@example.com' },
  owner: { phone: '+919000000002', email: 'owner@example.com' },
  city: 'Rajkot',
};

describe('buildBetaSeedRows', () => {
  const rows = buildBetaSeedRows(input);

  it('creates exactly one admin and one turf owner — and no players or fake activity', () => {
    expect(rows.users.map((u) => u.role)).toEqual(['ADMIN', 'TURF_OWNER']);
    expect(Object.keys(rows).sort()).toEqual(['facilities', 'hours', 'pricing', 'turfs', 'users']);
  });

  it('uses the supplied credentials and password hashes, not any fixed password', () => {
    expect(rows.users[0]).toMatchObject({
      phone_number: '+919000000001',
      email: 'admin@example.com',
      password_hash: 'hash-admin',
    });
    expect(rows.users[1].password_hash).toBe('hash-owner');
    // Only players carry a BFAM ID.
    expect(rows.users.every((u) => u.bfam_id === null)).toBe(true);
  });

  it('gives the owner two active, bookable turfs with weekday + weekend pricing and hours every day', () => {
    expect(rows.turfs).toHaveLength(2);
    for (const turf of rows.turfs) {
      expect(turf.owner_id).toBe(rows.users[1].user_id);
      expect(turf.turf_status).toBe('ACTIVE');
      const pricing = rows.pricing.filter((p) => p.turf_id === turf.turf_id);
      expect(pricing.map((p) => p.day_type).sort()).toEqual(['WEEKDAY', 'WEEKEND']);
      const hours = rows.hours.filter((h) => h.turf_id === turf.turf_id);
      expect(hours.map((h) => h.day_of_week).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });

  it('never embeds the well-known demo passwords', () => {
    const source = fs.readFileSync(path.join(__dirname, '../seed/betaSeed.ts'), 'utf8');
    expect(source).not.toContain('BfamPhase1');
    expect(source).not.toContain('Demo@1234');
  });
});
