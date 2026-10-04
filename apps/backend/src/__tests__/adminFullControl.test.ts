// Admin full control: account provisioning (owners / staff / admins are created
// by an admin, staff also by their owner), user management, "act as" an owner,
// and the Data Explorer. All ADMIN-only except the owner's create-staff route.

const ADMIN = 'aaaaaaaa-0000-4000-8000-005001';
const OWNER = 'aaaaaaaa-0000-4000-8000-005002';
const OWNER_WITH_TURFS = 'aaaaaaaa-0000-4000-8000-005003';
const STAFF = 'aaaaaaaa-0000-4000-8000-005004';
const PLAYER = 'aaaaaaaa-0000-4000-8000-005005';
const TURF = 'bbbbbbbb-0000-4000-8000-000000005001';

const updates: Array<{ table: string; values: Record<string, unknown>; where: unknown }> = [];
const inserts: Array<{ table: string; rows: Array<Record<string, unknown>> }> = [];
const queries: string[] = [];

const USERS: Record<string, Record<string, unknown>> = {
  [OWNER]: {
    user_id: OWNER,
    role: 'TURF_OWNER',
    phone_number: '+911000000002',
    email: null,
    city: null,
    account_status: 'ACTIVE',
    bfam_id: null,
    full_name: null,
  },
  [OWNER_WITH_TURFS]: {
    user_id: OWNER_WITH_TURFS,
    role: 'TURF_OWNER',
    phone_number: '+911000000003',
    email: null,
    city: null,
    account_status: 'ACTIVE',
    bfam_id: null,
    full_name: null,
  },
  [STAFF]: {
    user_id: STAFF,
    role: 'TURF_STAFF',
    phone_number: '+911000000004',
    email: null,
    city: null,
    account_status: 'ACTIVE',
    bfam_id: null,
    full_name: null,
  },
  [PLAYER]: {
    user_id: PLAYER,
    role: 'PLAYER',
    phone_number: '+911000000005',
    email: 'p@x.com',
    city: 'Rajkot',
    account_status: 'ACTIVE',
    bfam_id: 'BF1001',
    full_name: 'Pat Player',
  },
};

jest.mock('../config/sequelize', () => ({
  sequelize: {
    getQueryInterface: () => ({
      bulkUpdate: async (table: string, values: Record<string, unknown>, where: unknown) => {
        updates.push({ table, values, where });
      },
      bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
        inserts.push({ table, rows });
      },
    }),
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      queries.push(sql);

      // password login
      if (sql.includes('(phone_number = :identifier OR email = :identifier)')) {
        const hash = bcrypt.hashSync('Passw0rd!x', 4);
        if (r.identifier === 'suspended@x.com') {
          return [
            {
              user_id: STAFF,
              role: 'TURF_STAFF',
              password_hash: hash,
              account_status: 'SUSPENDED',
            },
          ];
        }
        if (r.identifier === 'active@x.com') {
          return [
            { user_id: STAFF, role: 'TURF_STAFF', password_hash: hash, account_status: 'ACTIVE' },
          ];
        }
        return [];
      }
      if (sql.includes('last_login_at = ')) return [];
      // act-as target lookup
      if (sql.includes("role IN ('TURF_OWNER', 'TURF_STAFF')")) {
        const u = USERS[String(r.targetId)];
        return u && (u.role === 'TURF_OWNER' || u.role === 'TURF_STAFF') ? [u] : [];
      }
      // owner dashboard turf list
      if (sql.includes('FROM turfs t') && sql.includes('LEFT JOIN venues')) {
        return [{ turf_id: TURF, owner_id: r.ownerUserId, turf_name: 'Green Park' }];
      }
      // staffService helpers
      if (sql.includes('SELECT turf_id, owner_id FROM turfs')) {
        return r.turfId === TURF ? [{ turf_id: TURF, owner_id: OWNER }] : [];
      }
      if (sql.includes('SELECT * FROM turf_staff_assignments')) {
        const row = inserts.find((i) => i.table === 'turf_staff_assignments')?.rows[0];
        return row ? [row] : [];
      }
      // admin user management
      if (sql.includes('phone_number = :phone')) {
        return r.phone === '+911000000002' ? [{ user_id: OWNER }] : [];
      }
      if (sql.includes('email = :email')) return [];
      if (sql.includes('FROM users u') && sql.includes('u.user_id = :userId')) {
        const created = inserts
          .filter((i) => i.table === 'users')
          .flatMap((i) => i.rows)
          .find((row) => row.user_id === r.userId);
        const u = USERS[String(r.userId)] ?? created;
        return u ? [{ ...u, created_at: new Date(), last_login_at: null }] : [];
      }
      if (sql.includes('FROM users u') && sql.includes('ORDER BY u.created_at')) {
        return Object.values(USERS).map((u) => ({
          ...u,
          created_at: new Date(),
          last_login_at: null,
        }));
      }
      if (sql.includes('FROM turfs WHERE owner_id = :userId')) {
        return [{ n: r.userId === OWNER_WITH_TURFS ? 2 : 0 }];
      }
      // data explorer
      if (sql.includes('FROM information_schema.tables')) {
        return [
          { name: 'users', n: 10 },
          { name: 'audit_logs', n: 50 },
          { name: 'promo_codes', n: 3 },
        ];
      }
      if (sql.includes('FROM information_schema.columns')) {
        if (r.table === 'users') {
          return [
            {
              name: 'user_id',
              col_type: 'char(36)',
              data_type: 'char',
              nullable: 'NO',
              col_key: 'PRI',
            },
            {
              name: 'phone_number',
              col_type: 'varchar(20)',
              data_type: 'varchar',
              nullable: 'NO',
              col_key: '',
            },
            {
              name: 'password_hash',
              col_type: 'varchar(255)',
              data_type: 'varchar',
              nullable: 'YES',
              col_key: '',
            },
          ];
        }
        return [
          {
            name: 'log_id',
            col_type: 'char(36)',
            data_type: 'char',
            nullable: 'NO',
            col_key: 'PRI',
          },
        ];
      }
      if (sql.startsWith('SELECT `user_id`') || sql.startsWith('SELECT `log_id`')) {
        return [{ user_id: PLAYER, phone_number: '+911000000005' }];
      }
      if (sql.startsWith('SELECT COUNT(*) AS n FROM `')) return [{ n: 1 }];
      if (sql.startsWith('SELECT * FROM `users`')) {
        return [{ user_id: PLAYER, phone_number: '+911000000005', password_hash: 'secret-hash' }];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

import bcrypt from 'bcrypt';
import request from 'supertest';
import app from '../app';

async function token(userId: string, role: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}
const asAdmin = async () => `Bearer ${await token(ADMIN, 'ADMIN')}`;

describe('admin user management', () => {
  beforeEach(() => {
    updates.length = 0;
    inserts.length = 0;
    queries.length = 0;
  });

  it('is admin-only', async () => {
    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`);
    expect(res.status).toBe(403);
  });

  it('lists every account', async () => {
    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', await asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(4);
  });

  it('creates a turf owner with a hashed password and no BFAM id', async () => {
    const res = await request(app)
      .post('/admin/users')
      .set('Authorization', await asAdmin())
      .send({ role: 'TURF_OWNER', phone_number: '+919876500001', password: 'Passw0rd!x' });

    const created = inserts.find((i) => i.table === 'users')?.rows[0];
    expect(created).toMatchObject({ role: 'TURF_OWNER', bfam_id: null, account_status: 'ACTIVE' });
    expect(created?.password_hash).toMatch(/^\$2[aby]\$/);
    expect(created?.password_hash).not.toBe('Passw0rd!x');
    expect(inserts.some((i) => i.table === 'audit_logs')).toBe(true);
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('TURF_OWNER');
  });

  it('refuses to create a PLAYER here', async () => {
    const res = await request(app)
      .post('/admin/users')
      .set('Authorization', await asAdmin())
      .send({ role: 'PLAYER', phone_number: '+919876500002', password: 'Passw0rd!x' });
    expect(res.status).toBe(400);
    expect(inserts.find((i) => i.table === 'users')).toBeUndefined();
  });

  it('rejects a duplicate phone number', async () => {
    const res = await request(app)
      .post('/admin/users')
      .set('Authorization', await asAdmin())
      .send({ role: 'TURF_STAFF', phone_number: '+911000000002', password: 'Passw0rd!x' });
    expect(res.status).toBe(409);
  });

  it('suspends another account but never your own', async () => {
    const ok = await request(app)
      .patch(`/admin/users/${STAFF}`)
      .set('Authorization', await asAdmin())
      .send({ account_status: 'SUSPENDED' });
    expect(ok.status).toBe(200);
    expect(updates.find((u) => u.table === 'users')?.values).toMatchObject({
      account_status: 'SUSPENDED',
    });

    USERS[ADMIN] = {
      ...USERS[PLAYER],
      user_id: ADMIN,
      role: 'ADMIN',
      phone_number: '+911000000001',
    };
    const self = await request(app)
      .patch(`/admin/users/${ADMIN}`)
      .set('Authorization', await asAdmin())
      .send({ account_status: 'SUSPENDED' });
    expect(self.status).toBe(400);
    delete USERS[ADMIN];
  });

  it('resets a password (stored hashed, never logged)', async () => {
    const res = await request(app)
      .post(`/admin/users/${STAFF}/password`)
      .set('Authorization', await asAdmin())
      .send({ password: 'BrandNew#123' });
    expect(res.status).toBe(204);
    const hash = updates.find((u) => u.table === 'users')?.values.password_hash as string;
    expect(hash).toMatch(/^\$2[aby]\$/);
    const audit = inserts.find((i) => i.table === 'audit_logs')?.rows[0];
    expect(JSON.stringify(audit)).not.toContain('BrandNew#123');
  });

  it('soft-deletes a staff account', async () => {
    const res = await request(app)
      .delete(`/admin/users/${STAFF}`)
      .set('Authorization', await asAdmin());
    expect(res.status).toBe(204);
    expect(updates.find((u) => u.table === 'users')?.values).toMatchObject({
      account_status: 'DELETED',
    });
  });

  it('will not delete an owner who still has turfs', async () => {
    const res = await request(app)
      .delete(`/admin/users/${OWNER_WITH_TURFS}`)
      .set('Authorization', await asAdmin());
    expect(res.status).toBe(409);
    expect(updates.find((u) => u.table === 'users')).toBeUndefined();
  });
});

describe('suspended accounts', () => {
  it('cannot sign in, even with the right password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'suspended@x.com', password: 'Passw0rd!x' });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/suspended/i);
  });

  it('active accounts still can', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'active@x.com', password: 'Passw0rd!x' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});

describe('admin acting as an owner', () => {
  it('lets an admin use owner endpoints as that owner', async () => {
    const res = await request(app)
      .get('/owner/turfs')
      .set('Authorization', await asAdmin())
      .set('X-Act-As-User', OWNER);
    expect(res.status).toBe(200);
    expect(res.body.results?.[0]?.owner_id ?? res.body[0]?.owner_id).toBe(OWNER);
  });

  it('404s when the target is not an owner or staff account', async () => {
    const res = await request(app)
      .get('/owner/turfs')
      .set('Authorization', await asAdmin())
      .set('X-Act-As-User', PLAYER);
    expect(res.status).toBe(404);
  });

  it('is ignored for non-admins', async () => {
    const res = await request(app)
      .get('/owner/turfs')
      .set('Authorization', `Bearer ${await token(PLAYER, 'PLAYER')}`)
      .set('X-Act-As-User', OWNER);
    expect(res.status).toBe(403);
  });

  it('an admin without the header is still not an owner', async () => {
    const res = await request(app)
      .get('/owner/turfs')
      .set('Authorization', await asAdmin());
    expect(res.status).toBe(403);
  });
});

describe('owner creates a staff account', () => {
  beforeEach(() => {
    updates.length = 0;
    inserts.length = 0;
  });

  it('creates the login and assigns it to the turf', async () => {
    const res = await request(app)
      .post(`/owner/turfs/${TURF}/staff/new`)
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`)
      .send({ phone_number: '+919876500009', password: 'Passw0rd!x', verified: true });
    expect(res.status).toBe(201);
    expect(inserts.find((i) => i.table === 'users')?.rows[0]).toMatchObject({ role: 'TURF_STAFF' });
    expect(inserts.find((i) => i.table === 'turf_staff_assignments')?.rows[0]).toMatchObject({
      turf_id: TURF,
      verification_status: 'APPROVED',
    });
  });

  it('starts unverified by default', async () => {
    await request(app)
      .post(`/owner/turfs/${TURF}/staff/new`)
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`)
      .send({ phone_number: '+919876500010', password: 'Passw0rd!x' });
    expect(inserts.find((i) => i.table === 'turf_staff_assignments')?.rows[0]).toMatchObject({
      verification_status: 'PENDING',
    });
  });

  it('is limited to the turf’s own owner', async () => {
    const res = await request(app)
      .post(`/owner/turfs/${TURF}/staff/new`)
      .set('Authorization', `Bearer ${await token(OWNER_WITH_TURFS, 'TURF_OWNER')}`)
      .send({ phone_number: '+919876500011', password: 'Passw0rd!x' });
    expect(res.status).toBe(403);
    expect(inserts.find((i) => i.table === 'users')).toBeUndefined();
  });

  it('needs a phone number and an 8+ character password', async () => {
    const res = await request(app)
      .post(`/owner/turfs/${TURF}/staff/new`)
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`)
      .send({ phone_number: '+919876500012', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('data explorer', () => {
  beforeEach(() => {
    updates.length = 0;
    inserts.length = 0;
    queries.length = 0;
  });

  it('lists tables and flags the read-only ones', async () => {
    const res = await request(app)
      .get('/admin/data/tables')
      .set('Authorization', await asAdmin());
    expect(res.status).toBe(200);
    const audit = res.body.results.find((t: { name: string }) => t.name === 'audit_logs');
    expect(audit.read_only).toBe(true);
  });

  it('never selects or returns secret columns', async () => {
    const res = await request(app)
      .get('/admin/data/users')
      .set('Authorization', await asAdmin());
    expect(res.status).toBe(200);
    const select = queries.find((q) => q.startsWith('SELECT `user_id`'));
    expect(select).toBeDefined();
    expect(select).not.toContain('password_hash');
    expect(res.body.columns.find((c: { name: string }) => c.name === 'password_hash').masked).toBe(
      true,
    );
    expect(JSON.stringify(res.body.rows)).not.toContain('secret-hash');
  });

  it('404s an unknown table', async () => {
    const res = await request(app)
      .get('/admin/data/nope')
      .set('Authorization', await asAdmin());
    expect(res.status).toBe(404);
  });

  it('refuses to write to a read-only table', async () => {
    const res = await request(app)
      .delete('/admin/data/audit_logs/x')
      .set('Authorization', await asAdmin());
    expect(res.status).toBe(403);
  });

  it('refuses to edit a secret column', async () => {
    const res = await request(app)
      .patch(`/admin/data/users/${PLAYER}`)
      .set('Authorization', await asAdmin())
      .send({ values: { password_hash: 'x' } });
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it('updates a row and records it in the audit log', async () => {
    const res = await request(app)
      .patch(`/admin/data/users/${PLAYER}`)
      .set('Authorization', await asAdmin())
      .send({ values: { phone_number: '+911999999999' } });
    expect(res.status).toBe(200);
    expect(updates.find((u) => u.table === 'users')?.values).toMatchObject({
      phone_number: '+911999999999',
    });
    expect(inserts.find((i) => i.table === 'audit_logs')?.rows[0]).toMatchObject({
      action: 'DATA_ROW_UPDATED',
    });
  });
});
