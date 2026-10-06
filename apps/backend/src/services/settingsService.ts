import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { istToday } from '../domain/time';
import { writeAuditLog } from './auditLogService';

// Platform settings (AW-12, PRD §9.1): the values an admin can change without a
// code release. Every setting has a built-in default equal to what the app did
// before this existed, so an empty table changes nothing — and if the settings
// table cannot be read at all, the defaults are used rather than failing
// bookings or payments.

export const SETTING_DEFAULTS = {
  // Cancellation refunds: full refund this many hours or more before the slot,
  // a partial refund from `partial_hours`, nothing after.
  'booking.refund_full_hours': 24,
  'booking.refund_partial_hours': 3,
  'booking.refund_partial_percent': 50,
  // How many days ahead a slot can be booked (null = no limit).
  'booking.max_advance_days': null as number | null,
  // BFAM Coins.
  'coins.value_in_rupees': 1,
  'coins.review_reward': 20,
  'coins.referral_reward': 100,
  // Shown in the apps.
  'support.phone': '',
  'support.email': '',
  'legal.terms_url': '',
  'legal.privacy_url': '',
  // App control.
  'app.min_version': '',
  'app.maintenance_enabled': false,
  'app.maintenance_message': '',
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = typeof SETTING_DEFAULTS;

export class SettingsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'SettingsError';
  }
}

// Bookings and online payments are switched off during maintenance. The route
// handlers map this to 503 with the admin's message.
export class MaintenanceModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaintenanceModeError';
  }
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  'BFAM is briefly down for maintenance. Please try again in a little while.';

const CACHE_MS = 15_000;
let cache: { at: number; settings: Settings } | null = null;

export function resetSettingsCache(): void {
  cache = null;
}

async function load(): Promise<Settings> {
  const merged: Record<string, unknown> = { ...SETTING_DEFAULTS };
  const rows = await sequelize.query<{ setting_key: string; setting_value: unknown }>(
    'SELECT setting_key, setting_value FROM platform_settings',
    { type: QueryTypes.SELECT },
  );
  for (const row of rows) {
    if (!(row.setting_key in SETTING_DEFAULTS)) continue;
    let value = row.setting_value;
    if (typeof value === 'string' && /^(null|true|false|-?\d+(\.\d+)?)$/.test(value)) {
      try {
        value = JSON.parse(value);
      } catch {
        /* keep the raw string */
      }
    }
    merged[row.setting_key] = value;
  }
  return merged as Settings;
}

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.settings;
  try {
    const settings = await load();
    cache = { at: Date.now(), settings };
    return settings;
  } catch {
    // Settings must never be the reason a booking or payment fails.
    return { ...SETTING_DEFAULTS };
  }
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

// ---- Validation -----------------------------------------------------------------

type Validator = (value: unknown) => string | null;
const intBetween =
  (min: number, max: number, label: string): Validator =>
  (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
      ? null
      : `${label} must be a whole number from ${min} to ${max}.`;
const text =
  (max: number, label: string, pattern?: RegExp, hint?: string): Validator =>
  (v) => {
    if (typeof v !== 'string' || v.length > max)
      return `${label} must be at most ${max} characters.`;
    if (v !== '' && pattern && !pattern.test(v)) return hint ?? `${label} is not valid.`;
    return null;
  };

const VALIDATORS: Record<SettingKey, Validator> = {
  'booking.refund_full_hours': intBetween(1, 720, 'Full-refund window'),
  'booking.refund_partial_hours': intBetween(0, 720, 'Partial-refund window'),
  'booking.refund_partial_percent': intBetween(0, 100, 'Partial refund percentage'),
  'booking.max_advance_days': (v) =>
    v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 730)
      ? null
      : 'Advance booking must be empty (no limit) or 1 to 730 days.',
  'coins.value_in_rupees': (v) =>
    typeof v === 'number' && v > 0 && v <= 100
      ? null
      : 'A coin’s value must be above ₹0 and at most ₹100.',
  'coins.review_reward': intBetween(0, 100_000, 'Review reward'),
  'coins.referral_reward': intBetween(0, 100_000, 'Referral reward'),
  'support.phone': text(
    30,
    'Support phone',
    /^\+?[0-9 ()-]{6,30}$/,
    'Enter a valid support phone number.',
  ),
  'support.email': text(
    150,
    'Support email',
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    'Enter a valid support email.',
  ),
  'legal.terms_url': text(
    300,
    'Terms link',
    /^https?:\/\/\S+$/,
    'The terms link must start with http:// or https://.',
  ),
  'legal.privacy_url': text(
    300,
    'Privacy link',
    /^https?:\/\/\S+$/,
    'The privacy link must start with http:// or https://.',
  ),
  'app.min_version': text(
    20,
    'Minimum version',
    /^\d+(\.\d+){0,2}$/,
    'Write the version like 1.4 or 1.4.2.',
  ),
  'app.maintenance_enabled': (v) =>
    typeof v === 'boolean' ? null : 'Maintenance mode must be on or off.',
  'app.maintenance_message': text(300, 'Maintenance message'),
};

export function validateSettingsPatch(
  patch: Record<string, unknown>,
  current: Settings,
): string | null {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in VALIDATORS)) return `Unknown setting ${key}.`;
    const problem = VALIDATORS[key as SettingKey](value);
    if (problem) return problem;
  }
  const next = { ...current, ...patch } as Settings;
  if (next['booking.refund_partial_hours'] >= next['booking.refund_full_hours']) {
    return 'The partial-refund window must be shorter than the full-refund window.';
  }
  return null;
}

export async function updateSettings(
  actorUserId: string,
  patch: Record<string, unknown>,
): Promise<Settings> {
  resetSettingsCache();
  const current = await getSettings();
  const problem = validateSettingsPatch(patch, current);
  if (problem) throw new SettingsError(problem, 400);

  const changed: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (JSON.stringify(current[key as SettingKey]) === JSON.stringify(value)) continue;
    changed[key] = value;
    before[key] = current[key as SettingKey];
  }
  if (Object.keys(changed).length === 0) return current;

  const now = new Date();
  for (const [key, value] of Object.entries(changed)) {
    await sequelize.query(
      `INSERT INTO platform_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES (:key, CAST(:value AS JSON), :actor, :now)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value),
         updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
      { replacements: { key, value: JSON.stringify(value), actor: actorUserId, now } },
    );
  }
  resetSettingsCache();
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'PLATFORM_SETTINGS_CHANGED',
    resourceType: 'platform_settings',
    resourceId: 'platform',
    beforeData: before,
    afterData: changed,
  });
  return getSettings();
}

// ---- What the rest of the backend asks for -----------------------------------------------

export interface RefundRules {
  fullHours: number;
  partialHours: number;
  partialPercent: number;
}

export async function getRefundRules(): Promise<RefundRules> {
  const s = await getSettings();
  return {
    fullHours: s['booking.refund_full_hours'],
    partialHours: s['booking.refund_partial_hours'],
    partialPercent: s['booking.refund_partial_percent'],
  };
}

export async function assertBookingsOpen(): Promise<void> {
  const s = await getSettings();
  if (s['app.maintenance_enabled']) {
    throw new MaintenanceModeError(s['app.maintenance_message'] || DEFAULT_MAINTENANCE_MESSAGE);
  }
}

export class BookingTooFarAheadError extends Error {
  constructor(days: number) {
    super(`Slots can be booked up to ${days} days ahead.`);
    this.name = 'BookingTooFarAheadError';
  }
}

export async function assertWithinAdvanceWindow(
  bookingDate: string,
  now = new Date(),
): Promise<void> {
  const days = await getSetting('booking.max_advance_days');
  if (!days) return;
  const last = new Date(`${istToday(now)}T00:00:00Z`).getTime() + days * 86_400_000;
  if (new Date(`${bookingDate}T00:00:00Z`).getTime() > last)
    throw new BookingTooFarAheadError(days);
}

// The part of the settings that is safe to show anyone, apps included.
export async function getPublicConfig() {
  const s = await getSettings();
  return {
    support: { phone: s['support.phone'], email: s['support.email'] },
    legal: { terms_url: s['legal.terms_url'], privacy_url: s['legal.privacy_url'] },
    app: {
      min_version: s['app.min_version'],
      maintenance: {
        enabled: s['app.maintenance_enabled'],
        message: s['app.maintenance_message'] || DEFAULT_MAINTENANCE_MESSAGE,
      },
    },
    coins: { value_in_rupees: s['coins.value_in_rupees'] },
    booking: { max_advance_days: s['booking.max_advance_days'] },
  };
}
