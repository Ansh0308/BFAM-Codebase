// Exercises GET /matches/:matchId/viewers, including the peak field added
// for long tail — Peak-viewer analytics (G-25). presenceService is mocked
// directly since its own behavior is already covered by
// viewerPresence.test.ts — this only checks the route wires all three
// values through.

const mockGetActiveViewerCount = jest.fn();
const mockGetTotalViews = jest.fn();
const mockGetPeakViewerCount = jest.fn();

jest.mock('../services/presenceService', () => ({
  getActiveViewerCount: (...args: unknown[]) => mockGetActiveViewerCount(...args),
  getTotalViews: (...args: unknown[]) => mockGetTotalViews(...args),
  getPeakViewerCount: (...args: unknown[]) => mockGetPeakViewerCount(...args),
}));

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async () => {
      throw new Error('Unexpected query in test fake');
    },
  },
}));

import request from 'supertest';
import app from '../app';

const PLAYER_ID = 'aaaaaaaa-0000-4000-8000-001801';
const MATCH_ID = 'bbbbbbbb-0000-4000-8000-001802';

async function tokenFor(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('GET /matches/:matchId/viewers (long tail — G-25 peak field)', () => {
  beforeEach(() => {
    mockGetActiveViewerCount.mockReset().mockResolvedValue(3);
    mockGetTotalViews.mockReset().mockResolvedValue(42);
    mockGetPeakViewerCount.mockReset().mockResolvedValue(7);
  });

  it('returns active, total, and peak viewer counts', async () => {
    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .get(`/matches/${MATCH_ID}/viewers`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ active: 3, total: 42, peak: 7 });
    expect(mockGetPeakViewerCount).toHaveBeenCalledWith(MATCH_ID);
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/matches/${MATCH_ID}/viewers`);
    expect(res.status).toBe(401);
  });
});
