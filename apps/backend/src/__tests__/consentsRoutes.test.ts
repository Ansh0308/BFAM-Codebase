// Exercises POST /consents and GET /consents/mine (backlog G-21).

const PLAYER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

let consents: Array<Record<string, unknown>> = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM user_consents WHERE user_id')) {
          return consents
            .filter((c) => c.user_id === r.userId)
            .sort((a, b) => (b.accepted_at as Date).getTime() - (a.accepted_at as Date).getTime());
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'user_consents') consents.push(...rows);
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('Consent routes (backlog G-21)', () => {
  beforeEach(() => {
    consents = [];
  });

  it('records a LOCATION consent for the authenticated caller', async () => {
    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${token}`)
      .send({ consent_type: 'LOCATION' });

    expect(res.status).toBe(201);
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({ user_id: PLAYER_ID, consent_type: 'LOCATION' });
  });

  it('rejects recording TERMS through this route — that only happens at registration', async () => {
    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${token}`)
      .send({ consent_type: 'TERMS' });

    expect(res.status).toBe(400);
    expect(consents).toHaveLength(0);
  });

  it('rejects an invalid consent_type', async () => {
    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${token}`)
      .send({ consent_type: 'NOT_A_TYPE' });

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/consents').send({ consent_type: 'CONTACTS' });
    expect(res.status).toBe(401);
  });

  it("returns the caller's own consent history, most recent first", async () => {
    const token = await tokenFor(PLAYER_ID);
    await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${token}`)
      .send({ consent_type: 'CONTACTS' });
    await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${token}`)
      .send({ consent_type: 'LOCATION' });

    const res = await request(app).get('/consents/mine').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].consent_type).toBe('LOCATION');
  });
});
