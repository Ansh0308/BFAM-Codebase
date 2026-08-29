// Exercises GET /cricketers/search. No CRICKET_API_KEY is set in this test
// environment, so the built-in dev/test fixture fallback (see
// services/cricketerSearchService.ts) is what's actually being verified —
// the endpoint and the Favorite Cricketer Search screen must work without a
// real API key.

import request from 'supertest';
import app from '../app';

describe('GET /cricketers/search', () => {
  const originalKey = process.env.CRICKET_API_KEY;

  beforeEach(() => {
    delete process.env.CRICKET_API_KEY;
  });

  afterAll(() => {
    if (originalKey) process.env.CRICKET_API_KEY = originalKey;
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
