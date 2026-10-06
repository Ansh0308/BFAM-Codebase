// Phase 9: platform settings (AW-12), home content (AW-13), staff customer assistance (SW-6).

const ADMIN = 'aaaaaaaa-0000-4000-8000-00b001';
const STAFF = 'aaaaaaaa-0000-4000-8000-00b002';
const PLAYER = 'aaaaaaaa-0000-4000-8000-00b003';
const STRANGER = 'aaaaaaaa-0000-4000-8000-00b004';
const TURF = 'bbbbbbbb-0000-4000-8000-00000000b001';
const OTHER_TURF = 'bbbbbbbb-0000-4000-8000-00000000b002';
const PROMO = 'cccccccc-0000-4000-8000-00000000b001';
const TOURNEY = 'dddddddd-0000-4000-8000-00000000b001';

type Row = Record<string, unknown>;
const settingRows: Row[] = [];
const settingWrites: Array<{ key: string; value: string }> = [];
let settingsReadable = true;
const inserts: Array<{ table: string; rows: Row[] }> = [];
const updates: Array<{ table: string; values: Row; where: Row }> = [];
const deletes: Array<{ table: string; where: Row }> = [];
let homeItems: Row[] = [];
let promoLive = true;
let turfActive = true;
let tournamentOpen = true;
let staffTurfs: string[] = [TURF];
let customerActive = true;
let customerBookings = 1;

jest.mock('../config/sequelize', () => ({
  sequelize: {
    getQueryInterface: () => ({
      bulkInsert: async (table: string, rows: Row[]) => {
        inserts.push({ table, rows });
        if (table === 'home_content_items') homeItems.push(...rows);
      },
      bulkUpdate: async (table: string, values: Row, where: Row) => {
        updates.push({ table, values, where });
      },
      bulkDelete: async (table: string, where: Row) => {
        deletes.push({ table, where });
      },
    }),
    query: async (sql: string, options: { replacements?: Row } = {}) => {
      const r = options.replacements ?? {};
      if (sql.includes('FROM platform_settings')) {
        if (!settingsReadable) throw new Error('table missing');
        return settingRows;
      }
      if (sql.includes('INSERT INTO platform_settings')) {
        settingWrites.push({ key: r.key as string, value: r.value as string });
        return [];
      }
      // ---- home content
      if (sql.includes('SELECT * FROM home_content_items WHERE item_id')) {
        return homeItems.filter((i) => i.item_id === r.itemId);
      }
      if (sql.includes('FROM home_content_items') && sql.includes('is_active = TRUE')) {
        return homeItems.filter((i) => i.is_active);
      }
      if (sql.includes('SELECT * FROM home_content_items')) return homeItems;
      if (sql.includes('SELECT promo_code_id, code, discount_type')) {
        return promoLive
          ? [
              {
                promo_code_id: PROMO,
                code: 'WELCOME50',
                discount_type: 'PERCENTAGE',
                discount_value: 50,
                max_discount_amount: 200,
                min_booking_amount: 500,
                valid_until: null,
              },
            ]
          : [];
      }
      if (sql.includes('code AS label FROM promo_codes'))
        return [{ id: PROMO, label: 'WELCOME50' }];
      if (sql.includes('turf_name AS label FROM turfs')) return [{ id: TURF, label: 'Green Park' }];
      if (sql.includes('name AS label FROM tournaments'))
        return [{ id: TOURNEY, label: 'Premier' }];
      if (sql.includes('SELECT promo_code_id AS x FROM promo_codes')) {
        return r.refId === PROMO ? [{ x: PROMO }] : [];
      }
      if (sql.includes('SELECT turf_id AS x FROM turfs'))
        return r.refId === TURF ? [{ x: TURF }] : [];
      if (sql.includes('SELECT tournament_id AS x FROM tournaments')) {
        return r.refId === TOURNEY ? [{ x: TOURNEY }] : [];
      }
      if (sql.includes('city, average_rating FROM turfs')) {
        return turfActive
          ? [{ turf_id: TURF, turf_name: 'Green Park', city: 'Rajkot', average_rating: '4.5' }]
          : [];
      }
      if (sql.includes('FROM tournaments WHERE tournament_id IN')) {
        return tournamentOpen
          ? [
              {
                tournament_id: TOURNEY,
                name: 'Premier',
                entry_fee: '1000',
                start_date: null,
                status: 'REGISTRATION_OPEN',
              },
            ]
          : [];
      }
      // ---- staff assist
      if (sql.includes('FROM turf_staff_assignments a JOIN turfs t')) {
        return staffTurfs.map((turf_id) => ({ turf_id }));
      }
      if (sql.includes('FROM users u LEFT JOIN players pl')) {
        return [
          { user_id: PLAYER, name: 'Ravi', phone_number: '+919800000001', bfam_id: 'BF1001' },
        ];
      }
      if (sql.includes('FROM bookings b JOIN turfs t')) {
        return customerBookings
          ? [
              {
                booking_id: 'bk1',
                turf_id: TURF,
                turf_name: 'Green Park',
                booking_date: '2026-10-01',
                start_time: '18:00:00',
                end_time: '19:00:00',
                booking_amount: '1200.00',
                booking_status: 'COMPLETED',
                payment_mode: 'CASH',
              },
            ]
          : [];
      }
      if (sql.includes("FROM users WHERE user_id = :userId AND role = 'PLAYER'")) {
        return customerActive && r.userId === PLAYER ? [{ user_id: PLAYER }] : [];
      }
      if (sql.includes('SELECT COUNT(*) AS n FROM bookings')) {
        return [{ n: r.userId === PLAYER ? customerBookings : 0 }];
      }
      if (sql.includes('SELECT phone_number FROM users WHERE user_id = :staffUserId')) {
        return [{ phone_number: '+919800000002' }];
      }
      return [];
    },
  },
}));

const mockCreateBooking = jest.fn();
const mockObligations = jest.fn();
const mockCash = jest.fn();
const mockComplaint = jest.fn();
const mockVerified = jest.fn();
const mockActivity = jest.fn();
jest.mock('../services/bookingService', () => ({
  createBooking: (...a: unknown[]) => mockCreateBooking(...a),
}));
jest.mock('../services/paymentService', () => ({
  ...jest.requireActual('../services/paymentService'),
  createObligationsForBooking: (...a: unknown[]) => mockObligations(...a),
  recordCashPayment: (...a: unknown[]) => mockCash(...a),
}));
jest.mock('../services/supportService', () => ({
  createComplaint: (...a: unknown[]) => mockComplaint(...a),
}));
jest.mock('../services/staffService', () => ({
  assertStaffVerified: (...a: unknown[]) => mockVerified(...a),
  recordStaffActivity: (...a: unknown[]) => mockActivity(...a),
}));
jest.mock('../services/auditLogService', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import {
  DEFAULT_MAINTENANCE_MESSAGE,
  SETTING_DEFAULTS,
  assertBookingsOpen,
  assertWithinAdvanceWindow,
  getPublicConfig,
  getRefundRules,
  getSettings,
  resetSettingsCache,
  updateSettings,
  validateSettingsPatch,
} from '../services/settingsService';
import { calculateRefundPercentage } from '../services/paymentService';
import { computeCoinRedemption } from '../domain/checkout';
import {
  HomeContentError,
  createItem,
  deleteItem,
  publicContent,
  updateItem,
} from '../services/homeContentService';
import {
  StaffAssistError,
  createWalkInBooking,
  lookupCustomers,
  raiseTicketForCustomer,
} from '../services/staffAssistService';

beforeEach(() => {
  jest.clearAllMocks();
  settingRows.length = 0;
  settingWrites.length = 0;
  inserts.length = 0;
  updates.length = 0;
  deletes.length = 0;
  homeItems = [];
  settingsReadable = true;
  promoLive = true;
  turfActive = true;
  tournamentOpen = true;
  staffTurfs = [TURF];
  customerActive = true;
  customerBookings = 1;
  resetSettingsCache();
  mockVerified.mockResolvedValue(undefined);
  mockActivity.mockResolvedValue(undefined);
  mockCreateBooking.mockResolvedValue({ booking_id: 'nb1', booking_amount: 1200 });
  mockObligations.mockResolvedValue([{ obligation_id: 'ob1' }]);
  mockCash.mockResolvedValue(undefined);
  mockComplaint.mockResolvedValue({ ticket_id: 'tk1' });
});

// ---- Platform settings ------------------------------------------------------------

describe('platform settings', () => {
  it('falls back to the built-in values when nothing is saved', async () => {
    const s = await getSettings();
    expect(s).toEqual(SETTING_DEFAULTS);
    expect(await getRefundRules()).toEqual({ fullHours: 24, partialHours: 3, partialPercent: 50 });
  });

  it('reads saved values over the defaults and ignores unknown keys', async () => {
    settingRows.push(
      { setting_key: 'booking.refund_full_hours', setting_value: 48 },
      { setting_key: 'app.maintenance_enabled', setting_value: 'true' },
      { setting_key: 'made.up', setting_value: 1 },
    );
    const s = await getSettings();
    expect(s['booking.refund_full_hours']).toBe(48);
    expect(s['app.maintenance_enabled']).toBe(true);
    expect(s).not.toHaveProperty('made.up');
  });

  it('fails open to the defaults if the table cannot be read', async () => {
    settingsReadable = false;
    expect(await getSettings()).toEqual(SETTING_DEFAULTS);
    await expect(assertBookingsOpen()).resolves.toBeUndefined();
  });

  it('rejects bad values with a plain message', () => {
    const cur = { ...SETTING_DEFAULTS };
    expect(validateSettingsPatch({ 'booking.refund_partial_percent': 150 }, cur)).toMatch(
      /0 to 100/,
    );
    expect(validateSettingsPatch({ 'coins.value_in_rupees': 0 }, cur)).toMatch(/above/);
    expect(validateSettingsPatch({ 'support.email': 'nope' }, cur)).toMatch(/valid support email/);
    expect(validateSettingsPatch({ 'legal.terms_url': 'ftp://x' }, cur)).toMatch(/http/);
    expect(validateSettingsPatch({ 'app.min_version': 'soon' }, cur)).toMatch(/version/);
    expect(validateSettingsPatch({ nonsense: 1 }, cur)).toMatch(/Unknown/);
    expect(validateSettingsPatch({ 'booking.max_advance_days': null }, cur)).toBeNull();
  });

  it('keeps the partial-refund window shorter than the full one', () => {
    const cur = { ...SETTING_DEFAULTS };
    expect(validateSettingsPatch({ 'booking.refund_partial_hours': 30 }, cur)).toMatch(/shorter/);
    expect(validateSettingsPatch({ 'booking.refund_full_hours': 2 }, cur)).toMatch(/shorter/);
    expect(
      validateSettingsPatch(
        { 'booking.refund_full_hours': 72, 'booking.refund_partial_hours': 12 },
        cur,
      ),
    ).toBeNull();
  });

  it('writes only the keys that changed', async () => {
    await updateSettings(ADMIN, {
      'booking.refund_full_hours': 24, // unchanged
      'coins.review_reward': 40,
    });
    expect(settingWrites).toEqual([{ key: 'coins.review_reward', value: '40' }]);
  });

  it('refuses an invalid update and writes nothing', async () => {
    await expect(updateSettings(ADMIN, { 'coins.referral_reward': -5 })).rejects.toMatchObject({
      status: 400,
    });
    expect(settingWrites).toHaveLength(0);
  });

  it('blocks new bookings in maintenance with the admin message', async () => {
    settingRows.push(
      { setting_key: 'app.maintenance_enabled', setting_value: true },
      { setting_key: 'app.maintenance_message', setting_value: 'Back at 6pm.' },
    );
    await expect(assertBookingsOpen()).rejects.toThrow('Back at 6pm.');
  });

  it('uses a default message when maintenance has none', async () => {
    settingRows.push({ setting_key: 'app.maintenance_enabled', setting_value: true });
    await expect(assertBookingsOpen()).rejects.toThrow(DEFAULT_MAINTENANCE_MESSAGE);
  });

  it('enforces the advance-booking window only when one is set', async () => {
    await expect(assertWithinAdvanceWindow('2099-01-01')).resolves.toBeUndefined();
    settingRows.push({ setting_key: 'booking.max_advance_days', setting_value: 7 });
    resetSettingsCache();
    await expect(assertWithinAdvanceWindow('2099-01-01')).rejects.toThrow(/7 days/);
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await expect(assertWithinAdvanceWindow(soon)).resolves.toBeUndefined();
  });

  it('exposes only the public part of the settings', async () => {
    settingRows.push({ setting_key: 'support.phone', setting_value: '+91 99999 11111' });
    const cfg = await getPublicConfig();
    expect(cfg.support.phone).toBe('+91 99999 11111');
    expect(cfg.app.maintenance.enabled).toBe(false);
    expect(JSON.stringify(cfg)).not.toContain('refund');
  });

  it('uses the configured refund rules and coin value', () => {
    const rules = { fullHours: 48, partialHours: 6, partialPercent: 25 };
    expect(calculateRefundPercentage(50, rules)).toBe(1);
    expect(calculateRefundPercentage(10, rules)).toBe(0.25);
    expect(calculateRefundPercentage(2, rules)).toBe(0);
    expect(calculateRefundPercentage(30)).toBe(1); // default 24h
    expect(computeCoinRedemption(100, 1000, 1000, 2)).toEqual({ coinsSpent: 50, discount: 100 });
    expect(computeCoinRedemption(100, 1000, 1000)).toEqual({ coinsSpent: 100, discount: 100 });
  });
});

// ---- Home content ---------------------------------------------------------------

describe('home content', () => {
  it('needs a title for an announcement and a target for anything else', async () => {
    await expect(createItem(ADMIN, { kind: 'ANNOUNCEMENT', title: ' ' })).rejects.toBeInstanceOf(
      HomeContentError,
    );
    await expect(createItem(ADMIN, { kind: 'OFFER' })).rejects.toMatchObject({ status: 400 });
  });

  it('refuses to feature something that does not exist', async () => {
    await expect(createItem(ADMIN, { kind: 'TURF', ref_id: 'nope' })).rejects.toMatchObject({
      status: 404,
    });
    expect(inserts).toHaveLength(0);
  });

  it('rejects an end before the start', async () => {
    await expect(
      createItem(ADMIN, {
        kind: 'ANNOUNCEMENT',
        title: 'x',
        starts_at: '2026-10-10',
        ends_at: '2026-10-01',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('creates a turf card and labels it', async () => {
    const made = await createItem(ADMIN, { kind: 'TURF', ref_id: TURF, display_order: 2 });
    expect(inserts[0].table).toBe('home_content_items');
    expect(made).toMatchObject({ kind: 'TURF', ref_label: 'Green Park', is_active: true });
  });

  it('updates, then deletes, an item', async () => {
    const made = await createItem(ADMIN, { kind: 'ANNOUNCEMENT', title: 'Hello' });
    await updateItem(ADMIN, made!.item_id as string, { is_active: false });
    expect(updates[0].values).toMatchObject({ is_active: false });
    await deleteItem(ADMIN, made!.item_id as string);
    expect(deletes[0].where).toEqual({ item_id: made!.item_id });
    await expect(deleteItem(ADMIN, 'missing')).rejects.toMatchObject({ status: 404 });
  });

  it('will not blank an announcement title', async () => {
    const made = await createItem(ADMIN, { kind: 'ANNOUNCEMENT', title: 'Hello' });
    await expect(updateItem(ADMIN, made!.item_id as string, { title: ' ' })).rejects.toMatchObject({
      status: 400,
    });
  });

  const seed = () => {
    homeItems = [
      {
        item_id: 'i1',
        kind: 'OFFER',
        ref_id: PROMO,
        title: null,
        body: null,
        link_url: null,
        display_order: 1,
        is_active: 1,
      },
      {
        item_id: 'i2',
        kind: 'TURF',
        ref_id: TURF,
        title: 'Our pick',
        body: null,
        link_url: null,
        display_order: 2,
        is_active: 1,
      },
      {
        item_id: 'i3',
        kind: 'TOURNAMENT',
        ref_id: TOURNEY,
        title: null,
        body: null,
        link_url: null,
        display_order: 3,
        is_active: 1,
      },
      {
        item_id: 'i4',
        kind: 'ANNOUNCEMENT',
        ref_id: null,
        title: 'Diwali',
        body: 'Open late',
        link_url: null,
        display_order: 4,
        is_active: 1,
      },
      {
        item_id: 'i5',
        kind: 'ANNOUNCEMENT',
        ref_id: null,
        title: 'Hidden',
        body: null,
        link_url: null,
        display_order: 5,
        is_active: 0,
      },
    ];
  };

  it('shows every live item to the app, with readable offer text', async () => {
    seed();
    const out = await publicContent();
    expect(out.offers).toHaveLength(1);
    expect(out.offers[0]).toMatchObject({
      code: 'WELCOME50',
      label: '50% off (up to ₹200)',
      min_booking_amount: 500,
    });
    expect(out.turfs[0]).toMatchObject({ turf_name: 'Green Park', title: 'Our pick' });
    expect(out.tournaments[0]).toMatchObject({ name: 'Premier', entry_fee: 1000 });
    expect(out.announcements.map((a) => a.title)).toEqual(['Diwali']);
  });

  it('quietly drops items whose offer, turf or tournament is no longer live', async () => {
    seed();
    promoLive = false;
    turfActive = false;
    tournamentOpen = false;
    const out = await publicContent();
    expect(out.offers).toHaveLength(0);
    expect(out.turfs).toHaveLength(0);
    expect(out.tournaments).toHaveLength(0);
    expect(out.announcements).toHaveLength(1);
  });
});

// ---- Staff customer assistance -----------------------------------------------------

describe('staff customer lookup', () => {
  it('needs three characters', async () => {
    await expect(lookupCustomers(STAFF, 'ab')).rejects.toMatchObject({ status: 400 });
  });

  it('finds a customer with their bookings at the staff turf, and logs it', async () => {
    const found = await lookupCustomers(STAFF, 'BF1001');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ user_id: PLAYER, bookings_here: 1 });
    expect(found[0].bookings[0].booking_amount).toBe(1200);
    expect(mockActivity).toHaveBeenCalledWith(STAFF, 'STAFF_CUSTOMER_LOOKUP', 'lookup', null, {
      matches: 1,
    });
  });

  it('returns nothing for staff with no turf', async () => {
    staffTurfs = [];
    expect(await lookupCustomers(STAFF, '98000')).toEqual([]);
  });

  it('stops unverified staff', async () => {
    mockVerified.mockRejectedValue(new Error('not verified'));
    await expect(lookupCustomers(STAFF, '98000')).rejects.toThrow('not verified');
  });
});

describe('staff walk-in booking', () => {
  const input = {
    turf_id: TURF,
    customer_user_id: PLAYER,
    booking_date: '2026-10-20',
    start_time: '18:00:00',
    duration_minutes: 60,
    collect_cash: true,
    cash_reference: 'R-12',
  };

  it('books in the customer’s name and records the cash', async () => {
    const res = await createWalkInBooking(STAFF, input);
    expect(res.paid).toBe(true);
    expect(mockVerified).toHaveBeenCalledWith(STAFF, 'collect_cash');
    expect(mockCreateBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        turfId: TURF,
        bookedBy: PLAYER,
        paymentMode: 'CASH',
        durationMinutes: 60,
      }),
    );
    expect(mockCash).toHaveBeenCalledWith(['ob1'], PLAYER, STAFF, 'R-12');
    expect(mockActivity).toHaveBeenCalledWith(
      STAFF,
      'STAFF_WALK_IN_BOOKING',
      'nb1',
      TURF,
      expect.anything(),
    );
  });

  it('leaves the payment due when no cash is taken', async () => {
    const res = await createWalkInBooking(STAFF, { ...input, collect_cash: false });
    expect(res.paid).toBe(false);
    expect(mockCash).not.toHaveBeenCalled();
    expect(mockVerified).toHaveBeenCalledWith(STAFF, undefined);
  });

  it('refuses a turf the staff member is not assigned to', async () => {
    await expect(
      createWalkInBooking(STAFF, { ...input, turf_id: OTHER_TURF }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });

  it('refuses a customer who is not an active player', async () => {
    customerActive = false;
    await expect(createWalkInBooking(STAFF, input)).rejects.toMatchObject({ status: 404 });
  });

  it('is blocked during maintenance', async () => {
    settingRows.push({ setting_key: 'app.maintenance_enabled', setting_value: true });
    await expect(createWalkInBooking(STAFF, input)).rejects.toThrow(DEFAULT_MAINTENANCE_MESSAGE);
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });
});

describe('staff raising a ticket', () => {
  it('logs a complaint in the customer’s account, noting who raised it', async () => {
    const res = await raiseTicketForCustomer(STAFF, {
      customer_user_id: PLAYER,
      category: 'BOOKING_ISSUE',
      description: 'Charged twice.',
      booking_id: 'bk1',
    });
    expect(res).toEqual({ ticket_id: 'tk1' });
    expect(mockComplaint).toHaveBeenCalledWith(
      PLAYER,
      expect.objectContaining({
        category: 'BOOKING_ISSUE',
        relatedEntityType: 'booking',
        relatedEntityId: 'bk1',
        description: expect.stringContaining('Raised at the turf desk by staff (+919800000002)'),
      }),
    );
    expect(mockActivity).toHaveBeenCalledWith(
      STAFF,
      'STAFF_TICKET_RAISED',
      PLAYER,
      null,
      expect.anything(),
    );
  });

  it('only for customers who have booked at the staff turf', async () => {
    await expect(
      raiseTicketForCustomer(STAFF, {
        customer_user_id: STRANGER,
        category: 'OTHER',
        description: 'Something odd.',
      }),
    ).rejects.toBeInstanceOf(StaffAssistError);
    expect(mockComplaint).not.toHaveBeenCalled();
  });
});
