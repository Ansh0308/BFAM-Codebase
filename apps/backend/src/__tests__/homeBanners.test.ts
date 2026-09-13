// API integration tests for backlog B-6: the player-facing GET /banners
// (active + within-schedule only) and the ADMIN-only CMS endpoints. Only
// `sequelize` is faked — the real routes/services run unmodified.

interface BannerRow {
  banner_id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const ADMIN_USER = 'aaaaaaaa-0000-4000-8000-000000000801';
const PLAYER_USER = 'bbbbbbbb-0000-4000-8000-000000000802';

let banners: BannerRow[];

function makeBanner(overrides: Partial<BannerRow> = {}): BannerRow {
  return {
    banner_id: 'banner-1',
    title: 'Summer Offer',
    image_url: 'https://example.com/banner.png',
    link_url: null,
    display_order: 0,
    is_active: true,
    starts_at: null,
    ends_at: null,
    created_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        if (sql.includes('home_banners') && sql.includes('is_active = TRUE')) {
          const now = options.replacements?.now as Date;
          return banners.filter((b) => {
            if (!b.is_active) return false;
            if (b.starts_at && b.starts_at > now) return false;
            if (b.ends_at && b.ends_at < now) return false;
            return true;
          });
        }
        if (sql.includes('FROM home_banners ORDER BY display_order')) return banners;
        if (sql.includes('FROM home_banners WHERE banner_id')) {
          const b = banners.find((x) => x.banner_id === options.replacements?.bannerId);
          return b ? [b] : [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'home_banners') banners.push(...(rows as unknown as BannerRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'home_banners') {
            const b = banners.find((x) => x.banner_id === where.banner_id);
            if (b) Object.assign(b, values);
          }
        },
        bulkDelete: async (table: string, where: Record<string, unknown>) => {
          if (table === 'home_banners') {
            banners = banners.filter((x) => x.banner_id !== where.banner_id);
          }
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string, role: 'ADMIN' | 'PLAYER') {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('GET /banners (backlog B-6, player-facing)', () => {
  beforeEach(() => {
    banners = [];
  });

  it('only returns active banners', async () => {
    banners.push(
      makeBanner({ banner_id: 'b1', is_active: true }),
      makeBanner({ banner_id: 'b2', is_active: false }),
    );
    const token = await tokenFor(PLAYER_USER, 'PLAYER');

    const res = await request(app).get('/banners').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results.map((b: BannerRow) => b.banner_id)).toEqual(['b1']);
  });

  it('excludes a banner scheduled to start in the future', async () => {
    const future = new Date(Date.now() + 86400000);
    banners.push(makeBanner({ banner_id: 'b1', starts_at: future }));
    const token = await tokenFor(PLAYER_USER, 'PLAYER');

    const res = await request(app).get('/banners').set('Authorization', `Bearer ${token}`);

    expect(res.body.results).toHaveLength(0);
  });

  it('excludes a banner whose schedule has already ended', async () => {
    const past = new Date(Date.now() - 86400000);
    banners.push(makeBanner({ banner_id: 'b1', ends_at: past }));
    const token = await tokenFor(PLAYER_USER, 'PLAYER');

    const res = await request(app).get('/banners').set('Authorization', `Bearer ${token}`);

    expect(res.body.results).toHaveLength(0);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/banners');
    expect(res.status).toBe(401);
  });
});

describe('/admin/banners (backlog B-6, admin CMS)', () => {
  beforeEach(() => {
    banners = [];
  });

  it('lets an admin create a banner', async () => {
    const token = await tokenFor(ADMIN_USER, 'ADMIN');
    const res = await request(app)
      .post('/admin/banners')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Diwali Offer', image_url: 'https://example.com/diwali.png' });

    expect(res.status).toBe(201);
    expect(banners).toHaveLength(1);
    expect(banners[0].title).toBe('Diwali Offer');
  });

  it('rejects a non-admin caller', async () => {
    const token = await tokenFor(PLAYER_USER, 'PLAYER');
    const res = await request(app)
      .post('/admin/banners')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Diwali Offer', image_url: 'https://example.com/diwali.png' });

    expect(res.status).toBe(403);
  });

  it('rejects an invalid payload (bad image URL)', async () => {
    const token = await tokenFor(ADMIN_USER, 'ADMIN');
    const res = await request(app)
      .post('/admin/banners')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Diwali Offer', image_url: 'not-a-url' });

    expect(res.status).toBe(400);
  });

  it('lets an admin update a banner (e.g. deactivate it)', async () => {
    banners.push(makeBanner({ banner_id: 'b1' }));
    const token = await tokenFor(ADMIN_USER, 'ADMIN');

    const res = await request(app)
      .patch('/admin/banners/b1')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(banners[0].is_active).toBe(false);
  });

  it('404s updating a banner that does not exist', async () => {
    const token = await tokenFor(ADMIN_USER, 'ADMIN');
    const res = await request(app)
      .patch('/admin/banners/does-not-exist')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(404);
  });

  it('lets an admin delete a banner', async () => {
    banners.push(makeBanner({ banner_id: 'b1' }));
    const token = await tokenFor(ADMIN_USER, 'ADMIN');

    const res = await request(app)
      .delete('/admin/banners/b1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(banners).toHaveLength(0);
  });

  it('lists every banner regardless of active state', async () => {
    banners.push(
      makeBanner({ banner_id: 'b1', is_active: true }),
      makeBanner({ banner_id: 'b2', is_active: false }),
    );
    const token = await tokenFor(ADMIN_USER, 'ADMIN');

    const res = await request(app).get('/admin/banners').set('Authorization', `Bearer ${token}`);

    expect(res.body.results).toHaveLength(2);
  });
});
