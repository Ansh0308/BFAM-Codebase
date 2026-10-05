// Phase 8: turf open/closed for the day, owner offers, admin payment + rewards
// oversight, staff scoring activity, close-turf permission, turf notifications.

const ADMIN = 'aaaaaaaa-0000-4000-8000-00a001';
const OWNER = 'aaaaaaaa-0000-4000-8000-00a002';
const OTHER_OWNER = 'aaaaaaaa-0000-4000-8000-00a003';
const STAFF = 'aaaaaaaa-0000-4000-8000-00a004';
const PLAYER = 'aaaaaaaa-0000-4000-8000-00a005';
const TURF = 'bbbbbbbb-0000-4000-8000-00000000a001';
const OFFER = 'cccccccc-0000-4000-8000-00000000a001';
const REWARD = 'dddddddd-0000-4000-8000-00000000a001';
const PLAN = 'eeeeeeee-0000-4000-8000-00000000a001';
const REDEMPTION = 'ffffffff-0000-4000-8000-00000000a001';

type Row = Record<string, unknown>;
const inserts: Array<{ table: string; rows: Row[] }> = [];
const updates: Array<{ table: string; values: Row; where: Row }> = [];
const deletes: Array<{ table: string; where: Row }> = [];
let closed = false;
let staffAssigned = true;
let staffPermissions: Row = {};
let offer: Row | null = null;
let codeTaken = false;
let redemptionsForReward = 0;
let membersForPlan = 0;
let redemptionStatus = 'PENDING';
let actorRole = 'TURF_STAFF';

jest.mock('../config/sequelize', () => ({
  sequelize: {
    getQueryInterface: () => ({
      bulkInsert: async (table: string, rows: Row[]) => {
        inserts.push({ table, rows });
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
      // ---- turf day status
      if (sql.includes('SELECT turf_id FROM turfs') && sql.includes('owner_id = :userId')) {
        return r.userId === OWNER ? [{ turf_id: TURF }] : [];
      }
      if (sql.includes('FROM turf_staff_assignments a JOIN turfs t')) {
        return r.userId === STAFF && staffAssigned ? [{ turf_id: TURF }] : [];
      }
      if (sql.includes('SELECT turf_id, turf_name, city FROM turfs')) {
        return [{ turf_id: TURF, turf_name: 'Green Park', city: 'Rajkot' }];
      }
      if (sql.includes("reason = 'DAY_CLOSED'") && sql.includes('SELECT DISTINCT turf_id')) {
        return closed ? [{ turf_id: TURF }] : [];
      }
      if (sql.includes("reason = 'DAY_CLOSED'") && sql.includes('SELECT block_id')) {
        return closed ? [{ block_id: 'blk1' }] : [];
      }
      if (sql.includes('FROM bookings') && sql.includes('GROUP BY turf_id'))
        return [{ turf_id: TURF, n: 3 }];
      if (
        sql.includes('SELECT turf_id FROM turfs WHERE turf_id = :turfId AND owner_id = :userId')
      ) {
        return r.turfId === TURF && r.userId === OWNER ? [{ turf_id: TURF }] : [];
      }
      if (
        sql.includes('SELECT turf_id FROM turfs WHERE turf_id = :turfId AND owner_id = :ownerId')
      ) {
        return r.turfId === TURF && r.ownerId === OWNER ? [{ turf_id: TURF }] : [];
      }
      if (sql.includes('SELECT assignment_id FROM turf_staff_assignments')) {
        return r.userId === STAFF && staffAssigned ? [{ assignment_id: 'as1' }] : [];
      }
      if (sql.includes('SELECT verification_status, permissions FROM turf_staff_assignments')) {
        return [{ verification_status: 'APPROVED', permissions: staffPermissions }];
      }
      // ---- offers
      if (sql.includes('promo_code_id = :offerId AND p.owner_id = :ownerId')) {
        const made = inserts.find(
          (i) => i.table === 'promo_codes' && i.rows[0].promo_code_id === r.offerId,
        );
        if (made) return [{ ...made.rows[0], turf_name: null, redeemed: 0 }];
        return offer && r.offerId === OFFER && r.ownerId === OWNER ? [offer] : [];
      }
      if (
        sql.includes('FROM promo_codes p LEFT JOIN turfs t') &&
        sql.includes('p.owner_id = :ownerId ORDER BY')
      ) {
        return offer ? [offer] : [];
      }
      if (sql.includes('SELECT promo_code_id FROM promo_codes WHERE code = :code')) {
        return codeTaken ? [{ promo_code_id: 'x' }] : [];
      }
      // ---- rewards / plans
      if (sql.includes('FROM rewards r ORDER BY')) {
        const made = inserts.find((i) => i.table === 'rewards');
        return [
          {
            reward_id: REWARD,
            name: 'Cap',
            description: null,
            coin_cost: 500,
            is_active: 1,
            created_at: new Date(),
            redemptions: redemptionsForReward,
          },
          ...(made ? [{ ...made.rows[0], redemptions: 0 }] : []),
        ];
      }
      if (sql.includes('SELECT reward_id FROM rewards WHERE'))
        return r.rewardId === REWARD ? [{ reward_id: REWARD }] : [];
      if (sql.includes('FROM reward_redemptions WHERE reward_id'))
        return [{ n: redemptionsForReward }];
      if (
        sql.includes('FROM reward_redemptions x') &&
        sql.includes('JOIN rewards r ON r.reward_id = x.reward_id JOIN players')
      ) {
        return r.redemptionId === REDEMPTION
          ? [{ status: redemptionStatus, user_id: PLAYER, reward_name: 'Cap' }]
          : [];
      }
      if (sql.includes('FROM reward_redemptions x') && sql.includes('JOIN players pl')) {
        return [
          {
            redemption_id: REDEMPTION,
            status: 'PENDING',
            coins_spent: 500,
            reward_name: 'Cap',
            player_name: 'Asha',
            player_phone: '+91',
          },
        ];
      }
      if (sql.includes('FROM membership_plans m ORDER BY')) {
        return [
          {
            plan_id: PLAN,
            name: 'Monthly',
            duration_days: 30,
            coin_cost: 1500,
            discount_percent: 10,
            is_active: 1,
            active_members: 2,
            total_members: membersForPlan,
            created_at: new Date(),
          },
        ];
      }
      if (sql.includes('SELECT plan_id FROM membership_plans'))
        return r.planId === PLAN ? [{ plan_id: PLAN }] : [];
      if (sql.includes('FROM player_memberships WHERE plan_id')) return [{ n: membersForPlan }];
      // ---- payments oversight
      if (sql.includes('FROM payments p') && sql.includes('ORDER BY p.initiated_at DESC')) {
        return [
          {
            payment_id: 'p1',
            amount: '500.00',
            payment_method: 'UPI',
            payment_status: 'SUCCESS',
            initiated_at: new Date(),
            completed_at: new Date(),
            reference: 'rzp_1',
            payer_phone: '+911',
            payer_name: 'Asha',
            collected_by_phone: null,
            kind: 'TOURNAMENT_ENTRY',
            context: 'Diwali Cup',
            refunded: '0',
          },
          {
            payment_id: 'p2',
            amount: '1200.00',
            payment_method: 'CASH',
            payment_status: 'SUCCESS',
            initiated_at: new Date(),
            completed_at: new Date(),
            reference: null,
            payer_phone: '+912',
            payer_name: null,
            collected_by_phone: '+919',
            kind: 'BOOKING',
            context: 'Green Park',
            refunded: '300',
          },
        ];
      }
      if (sql.includes('GROUP BY p.payment_status, p.payment_method')) {
        return [
          { payment_status: 'SUCCESS', payment_method: 'UPI', n: 1, total: '500' },
          { payment_status: 'SUCCESS', payment_method: 'CASH', n: 1, total: '1200' },
          { payment_status: 'FAILED', payment_method: 'UPI', n: 1, total: '400' },
          { payment_status: 'PENDING', payment_method: 'RAZORPAY', n: 1, total: '250' },
        ];
      }
      if (sql.includes('SUM(r.refund_amount) AS total FROM refunds r')) return [{ total: '300' }];
      if (sql.includes('FROM refunds r') && sql.includes('JOIN payments p')) {
        return [
          {
            refund_id: 'r1',
            payment_id: 'p2',
            refund_amount: '300',
            reason: 'Cancelled',
            refund_status: 'COMPLETED',
            gateway_refund_id: null,
            payment_amount: '1200',
            payment_method: 'CASH',
            payer_phone: '+912',
            payer_name: null,
            created_at: new Date(),
            completed_at: new Date(),
          },
        ];
      }
      // ---- staff scoring activity
      if (sql.includes('SELECT role FROM users WHERE user_id = :actorUserId')) {
        if (actorRole === 'BROKEN') throw new Error('db down');
        return [{ role: actorRole }];
      }
      if (sql.includes('SELECT b.turf_id FROM matches m JOIN bookings b'))
        return [{ turf_id: TURF }];
      // ---- admin turf notifications
      if (sql.includes('SELECT turf_status, owner_id, turf_name FROM turfs')) {
        return [{ turf_status: 'PENDING_APPROVAL', owner_id: OWNER, turf_name: 'New Pitch' }];
      }
      if (sql.includes('FROM turfs t') && sql.includes('JOIN users u')) {
        return [
          {
            turf_id: TURF,
            turf_name: 'New Pitch',
            turf_status: 'ACTIVE',
            owner_id: OWNER,
            rejection_reason: null,
          },
        ];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));
jest.mock('../services/notificationService', () => ({
  sendNotification: jest.fn(async () => ({ notification_id: 'n', pushed: false })),
  sendNotificationToMany: jest.fn(async () => undefined),
}));

import request from 'supertest';
import app from '../app';
import { sendNotification } from '../services/notificationService';
import {
  assertStaffVerified,
  normalizePermissions,
  recordScoringActivity,
} from '../services/staffService';
import { StaffPermissionDeniedError } from '../domain/errors';

const notify = sendNotification as jest.Mock;

async function auth(userId: string, role: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return `Bearer ${res.body.token as string}`;
}

const offerRow = (over: Row = {}): Row => ({
  promo_code_id: OFFER,
  code: 'WELCOME20',
  discount_type: 'PERCENTAGE',
  discount_value: '20.00',
  max_discount_amount: '300.00',
  min_booking_amount: '0',
  usage_limit_total: null,
  usage_limit_per_player: 1,
  valid_from: null,
  valid_until: null,
  is_active: 1,
  turf_id: null,
  turf_name: null,
  redeemed: 0,
  created_at: new Date(),
  owner_id: OWNER,
  ...over,
});

beforeEach(() => {
  inserts.length = 0;
  updates.length = 0;
  deletes.length = 0;
  notify.mockClear();
  closed = false;
  staffAssigned = true;
  staffPermissions = {};
  offer = null;
  codeTaken = false;
  redemptionsForReward = 0;
  membersForPlan = 0;
  redemptionStatus = 'PENDING';
  actorRole = 'TURF_STAFF';
});

describe('turf open / closed for the day', () => {
  it('lists the owner’s turfs with today’s state and booking count', async () => {
    const res = await request(app)
      .get('/owner/turf-status')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ turf_id: TURF, closed: false, bookings_today: 3 });
  });

  it('closing blocks the whole of today and is audited', async () => {
    const res = await request(app)
      .post(`/owner/turfs/${TURF}/closed`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ closed: true });
    expect(res.status).toBe(200);
    expect(res.body.closed).toBe(true);
    const block = inserts.find((i) => i.table === 'turf_availability_blocks')!.rows[0];
    expect(block).toMatchObject({ turf_id: TURF, reason: 'DAY_CLOSED', created_by: OWNER });
    const hours =
      ((block.end_datetime as Date).getTime() - (block.start_datetime as Date).getTime()) /
      3_600_000;
    expect(hours).toBe(24);
    expect(inserts.find((i) => i.table === 'audit_logs')?.rows[0]).toMatchObject({
      action: 'TURF_CLOSED_TODAY',
    });
  });

  it('closing twice does nothing the second time', async () => {
    closed = true;
    const res = await request(app)
      .post(`/owner/turfs/${TURF}/closed`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ closed: true });
    expect(res.status).toBe(200);
    expect(inserts.find((i) => i.table === 'turf_availability_blocks')).toBeUndefined();
  });

  it('reopening removes today’s block', async () => {
    closed = true;
    const res = await request(app)
      .post(`/owner/turfs/${TURF}/closed`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ closed: false });
    expect(res.status).toBe(200);
    expect(deletes).toEqual([{ table: 'turf_availability_blocks', where: { block_id: 'blk1' } }]);
  });

  it('another owner cannot touch the turf', async () => {
    const res = await request(app)
      .post(`/owner/turfs/${TURF}/closed`)
      .set('Authorization', await auth(OTHER_OWNER, 'TURF_OWNER'))
      .send({ closed: true });
    expect(res.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it('assigned, verified staff can close it; staff elsewhere cannot', async () => {
    const ok = await request(app)
      .post(`/staff/turfs/${TURF}/closed`)
      .set('Authorization', await auth(STAFF, 'TURF_STAFF'))
      .send({ closed: true });
    expect(ok.status).toBe(200);
    expect(inserts.find((i) => i.table === 'audit_logs')?.rows[0]).toMatchObject({
      actor_role: 'TURF_STAFF',
    });

    staffAssigned = false;
    inserts.length = 0;
    const no = await request(app)
      .post(`/staff/turfs/${TURF}/closed`)
      .set('Authorization', await auth(STAFF, 'TURF_STAFF'))
      .send({ closed: true });
    expect(no.status).toBe(403);
    expect(inserts).toHaveLength(0);
  });

  it('staff the owner switched off cannot close it', async () => {
    staffPermissions = { close_turf: false };
    const res = await request(app)
      .post(`/staff/turfs/${TURF}/closed`)
      .set('Authorization', await auth(STAFF, 'TURF_STAFF'))
      .send({ closed: true });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/open or close the turf/);
  });

  it('is role-gated and needs a boolean', async () => {
    expect(
      (
        await request(app)
          .post(`/owner/turfs/${TURF}/closed`)
          .set('Authorization', await auth(PLAYER, 'PLAYER'))
          .send({ closed: true })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/owner/turfs/${TURF}/closed`)
          .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
          .send({})
      ).status,
    ).toBe(400);
  });

  it('close_turf is one more switchable permission, on by default', async () => {
    expect(normalizePermissions({}).close_turf).toBe(true);
    staffPermissions = { close_turf: false };
    await expect(assertStaffVerified(STAFF, 'close_turf')).rejects.toBeInstanceOf(
      StaffPermissionDeniedError,
    );
    await expect(assertStaffVerified(STAFF, 'check_in')).resolves.toBeUndefined();
  });
});

describe('owner offers', () => {
  const create = async (body: Row, user = OWNER) =>
    request(app)
      .post('/owner/offers')
      .set('Authorization', await auth(user, 'TURF_OWNER'))
      .send(body);
  const VALID = { code: 'welcome20', discount_type: 'PERCENTAGE', discount_value: 20 };

  it('creates an offer tied to the owner, with the code upper-cased', async () => {
    const res = await create({ ...VALID, turf_id: TURF });
    expect(res.status).toBe(201);
    expect(inserts.find((i) => i.table === 'promo_codes')?.rows[0]).toMatchObject({
      code: 'WELCOME20',
      owner_id: OWNER,
      created_by: OWNER,
      turf_id: TURF,
      is_active: true,
    });
  });

  it('only for the owner’s own turf, and never a duplicate code', async () => {
    expect((await create({ ...VALID, turf_id: TURF }, OTHER_OWNER)).status).toBe(404);
    codeTaken = true;
    const dup = await create(VALID);
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/already in use/);
  });

  it('validates the discount and dates', async () => {
    expect((await create({ ...VALID, code: 'x' })).status).toBe(400);
    expect((await create({ ...VALID, discount_value: 150 })).status).toBe(400);
    expect(
      (
        await create({
          ...VALID,
          valid_from: '2026-12-01T00:00:00.000Z',
          valid_until: '2026-11-01T00:00:00.000Z',
        })
      ).status,
    ).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it('lists, switches off and edits only the owner’s own', async () => {
    offer = offerRow();
    const owner = await auth(OWNER, 'TURF_OWNER');
    const list = await request(app).get('/owner/offers').set('Authorization', owner);
    expect(list.body.results[0]).toMatchObject({
      code: 'WELCOME20',
      discount_value: 20,
      is_active: true,
    });

    expect(
      (
        await request(app)
          .post(`/owner/offers/${OFFER}/active`)
          .set('Authorization', owner)
          .send({ is_active: false })
      ).status,
    ).toBe(200);
    expect(updates.find((u) => u.table === 'promo_codes')?.values).toEqual({ is_active: false });

    const stranger = await auth(OTHER_OWNER, 'TURF_OWNER');
    expect(
      (
        await request(app)
          .patch(`/owner/offers/${OFFER}`)
          .set('Authorization', stranger)
          .send({ discount_value: 50 })
      ).status,
    ).toBe(404);
  });

  it('cannot delete an offer players have used', async () => {
    offer = offerRow({ redeemed: 4 });
    const owner = await auth(OWNER, 'TURF_OWNER');
    const blocked = await request(app).delete(`/owner/offers/${OFFER}`).set('Authorization', owner);
    expect(blocked.status).toBe(409);
    expect(deletes).toHaveLength(0);

    offer = offerRow();
    expect(
      (await request(app).delete(`/owner/offers/${OFFER}`).set('Authorization', owner)).status,
    ).toBe(204);
    expect(deletes[0]).toEqual({ table: 'promo_codes', where: { promo_code_id: OFFER } });
  });
});

describe('admin payment & refund oversight', () => {
  const get = async (qs: string, user = ADMIN, role = 'ADMIN') =>
    request(app)
      .get(`/admin/payments?${qs}`)
      .set('Authorization', await auth(user, role));

  it('is admin-only and needs a range', async () => {
    expect((await get('from=2026-10-01&to=2026-10-31', OWNER, 'TURF_OWNER')).status).toBe(403);
    expect((await get('')).status).toBe(400);
  });

  it('lists payments with what they were for and any refund', async () => {
    const res = await get('from=2026-10-01&to=2026-10-31');
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({
      kind: 'TOURNAMENT_ENTRY',
      context: 'Diwali Cup',
      amount: 500,
      payment_method: 'UPI',
    });
    expect(res.body.results[1]).toMatchObject({
      kind: 'BOOKING',
      refunded: 300,
      collected_by_phone: '+919',
    });
  });

  it('summarises collected, pending, failed and refunded money by method', async () => {
    const { summary } = (await get('from=2026-10-01&to=2026-10-31')).body;
    expect(summary).toMatchObject({
      collected: 1700,
      pending: 250,
      failed: 400,
      refunded: 300,
      count: 4,
    });
    expect(summary.by_method.find((m: Row) => m.method === 'CASH')).toMatchObject({
      payments: 1,
      amount: 1200,
    });
  });

  it('rejects a backwards range or one over a year', async () => {
    expect((await get('from=2026-10-31&to=2026-10-01')).status).toBe(400);
    const long = await get('from=2024-01-01&to=2026-10-01');
    expect(long.status).toBe(400);
    expect(long.body.error.message).toMatch(/366/);
  });

  it('lists refunds', async () => {
    const res = await request(app)
      .get('/admin/refunds?from=2026-10-01&to=2026-10-31')
      .set('Authorization', await auth(ADMIN, 'ADMIN'));
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({
      refund_amount: 300,
      payment_amount: 1200,
      refund_status: 'COMPLETED',
    });
  });
});

describe('admin rewards & membership configuration', () => {
  const admin = async () => auth(ADMIN, 'ADMIN');

  it('is admin-only', async () => {
    expect(
      (
        await request(app)
          .get('/admin/rewards')
          .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      ).status,
    ).toBe(403);
  });

  it('creates, edits and switches off a reward', async () => {
    const created = await request(app)
      .post('/admin/rewards')
      .set('Authorization', await admin())
      .send({ name: 'Water bottle', coin_cost: 200 });
    expect(created.status).toBe(201);
    expect(inserts.find((i) => i.table === 'rewards')?.rows[0]).toMatchObject({
      name: 'Water bottle',
      coin_cost: 200,
      is_active: true,
    });

    const edited = await request(app)
      .patch(`/admin/rewards/${REWARD}`)
      .set('Authorization', await admin())
      .send({ coin_cost: 450, is_active: false });
    expect(edited.status).toBe(200);
    expect(updates.find((u) => u.table === 'rewards')?.values).toEqual({
      coin_cost: 450,
      is_active: false,
    });
    expect(inserts.filter((i) => i.table === 'audit_logs').length).toBeGreaterThan(0);
  });

  it('validates a reward and 404s an unknown one', async () => {
    expect(
      (
        await request(app)
          .post('/admin/rewards')
          .set('Authorization', await admin())
          .send({ name: 'x', coin_cost: 0 })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch('/admin/rewards/aaaaaaaa-0000-4000-8000-000000000000')
          .set('Authorization', await admin())
          .send({ coin_cost: 5 })
      ).status,
    ).toBe(404);
  });

  it('will not delete a reward players redeemed', async () => {
    redemptionsForReward = 2;
    const blocked = await request(app)
      .delete(`/admin/rewards/${REWARD}`)
      .set('Authorization', await admin());
    expect(blocked.status).toBe(409);
    expect(deletes).toHaveLength(0);
    redemptionsForReward = 0;
    expect(
      (
        await request(app)
          .delete(`/admin/rewards/${REWARD}`)
          .set('Authorization', await admin())
      ).status,
    ).toBe(204);
  });

  it('hands a redemption over once, and tells the player', async () => {
    const list = await request(app)
      .get('/admin/reward-redemptions')
      .set('Authorization', await admin());
    expect(list.body.results[0]).toMatchObject({ reward_name: 'Cap', status: 'PENDING' });

    const ok = await request(app)
      .post(`/admin/reward-redemptions/${REDEMPTION}/fulfil`)
      .set('Authorization', await admin());
    expect(ok.status).toBe(204);
    expect(updates.find((u) => u.table === 'reward_redemptions')?.values).toEqual({
      status: 'FULFILLED',
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: PLAYER,
        event: 'REWARD_RECEIVED',
        params: { rewardName: 'Cap' },
      }),
    );

    redemptionStatus = 'FULFILLED';
    expect(
      (
        await request(app)
          .post(`/admin/reward-redemptions/${REDEMPTION}/fulfil`)
          .set('Authorization', await admin())
      ).status,
    ).toBe(409);
  });

  it('manages membership plans, and keeps one members have held', async () => {
    const created = await request(app)
      .post('/admin/membership-plans')
      .set('Authorization', await admin())
      .send({ name: 'Season Pass', duration_days: 90, coin_cost: 3500, discount_percent: 15 });
    expect(created.status).toBe(201);
    expect(
      (
        await request(app)
          .post('/admin/membership-plans')
          .set('Authorization', await admin())
          .send({ name: 'Bad', duration_days: 30, coin_cost: 10, discount_percent: 150 })
      ).status,
    ).toBe(400);

    const list = await request(app)
      .get('/admin/membership-plans')
      .set('Authorization', await admin());
    expect(list.body.results[0]).toMatchObject({ name: 'Monthly', active_members: 2 });

    membersForPlan = 5;
    expect(
      (
        await request(app)
          .delete(`/admin/membership-plans/${PLAN}`)
          .set('Authorization', await admin())
      ).status,
    ).toBe(409);
    membersForPlan = 0;
    expect(
      (
        await request(app)
          .delete(`/admin/membership-plans/${PLAN}`)
          .set('Authorization', await admin())
      ).status,
    ).toBe(204);
  });
});

describe('owner notified when a turf is reviewed', () => {
  it('approval tells the owner the turf is live', async () => {
    await request(app)
      .post(`/admin/turfs/${TURF}/approve`)
      .set('Authorization', await auth(ADMIN, 'ADMIN'));
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        event: 'TURF_UPDATE',
        params: { message: expect.stringContaining('approved') },
      }),
    );
  });

  it('rejection tells the owner why', async () => {
    await request(app)
      .post(`/admin/turfs/${TURF}/reject`)
      .set('Authorization', await auth(ADMIN, 'ADMIN'))
      .send({ reason: 'Photos are missing' });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        event: 'TURF_UPDATE',
        params: { message: expect.stringContaining('Photos are missing') },
      }),
    );
  });
});

describe('staff scoring activity (match level, not every ball)', () => {
  const activity = () => inserts.filter((i) => i.table === 'audit_logs').map((i) => i.rows[0]);

  it('logs a staff member starting an innings or finishing a match, with the turf', async () => {
    await recordScoringActivity('m1', STAFF, 'STAFF_INNINGS_STARTED', { innings_number: 1 });
    await recordScoringActivity('m1', STAFF, 'STAFF_MATCH_FINISHED', { result_type: 'WIN' });
    const rows = activity();
    expect(rows.map((r) => r.action)).toEqual(['STAFF_INNINGS_STARTED', 'STAFF_MATCH_FINISHED']);
    expect(rows[0]).toMatchObject({
      actor_user_id: STAFF,
      actor_role: 'TURF_STAFF',
      resource_type: 'staff_activity',
    });
    expect(JSON.parse(rows[0].after_data as string)).toMatchObject({
      turf_id: TURF,
      innings_number: 1,
    });
  });

  it('records nothing for an owner, a player or anyone else scoring', async () => {
    for (const role of ['TURF_OWNER', 'PLAYER', 'ADMIN']) {
      actorRole = role;
      await recordScoringActivity('m1', OWNER, 'STAFF_INNINGS_STARTED');
    }
    expect(activity()).toHaveLength(0);
  });

  it('never fails the scoring action if the log cannot be written', async () => {
    actorRole = 'BROKEN';
    await expect(
      recordScoringActivity('m1', STAFF, 'STAFF_MATCH_FINISHED'),
    ).resolves.toBeUndefined();
    expect(activity()).toHaveLength(0);
  });
});
