// Exercises GET /cricketers/search's DEV/TEST-ONLY fixture fallback — the
// path taken when the `cricketers` table hasn't been seeded (see
// services/cricketerSearchService.ts). `../config/sequelize` is mocked to
// force that "empty table" condition deterministically: the real dev
// database has the table seeded (18k+ real players, see
// src/seed/cricketersSeed.ts), so relying on incidental DB state here would
// make this test depend on whether someone happened to run the seed script
// — exactly the kind of non-hermetic test that broke once that seed step
// was actually run.
//
// Neither RAPIDAPI_KEY nor CRICKET_API_KEY is allowed to leak in from the
// real .env either, so what's under test is specifically the fixture
// fallback, not a live API. (RapidAPI's live integration and the real
// cricketers-table search are exercised separately, manually, against real
// data — see cricketerSearchRapidApi.test.ts for the mocked-DB version of
// the table-backed path.)

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string) => {
      if (sql.includes('SELECT COUNT(*) AS cnt FROM cricketers')) {
        return [{ cnt: 0 }];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

import request from 'supertest';
import app from '../app';

describe('GET /cricketers/search', () => {
  const originalRapidApiKey = process.env.RAPIDAPI_KEY;
  const originalCricApiKey = process.env.CRICKET_API_KEY;

  beforeEach(() => {
    delete process.env.RAPIDAPI_KEY;
    delete process.env.CRICKET_API_KEY;
  });

  afterAll(() => {
    if (originalRapidApiKey) process.env.RAPIDAPI_KEY = originalRapidApiKey;
    if (originalCricApiKey) process.env.CRICKET_API_KEY = originalCricApiKey;
  });

  it('returns the full fixture list for an empty query', async () => {
    const response = await request(app).get('/cricketers/search').query({ q: '' });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(5);
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        external_id: expect.any(String),
      }),
    );
  });

  it('filters fixtures by substring match, case-insensitively', async () => {
    const response = await request(app).get('/cricketers/search').query({ q: 'kohli' });
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Virat Kohli');
  });

  it('returns an empty array for a query matching nothing', async () => {
    const response = await request(app).get('/cricketers/search').query({ q: 'zzzznotaplayer' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
