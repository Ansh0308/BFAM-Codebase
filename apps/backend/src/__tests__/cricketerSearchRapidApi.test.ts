// Exercises the RapidAPI-backed FALLBACK path of cricketerSearchService.ts
// — the one taken when the local `cricketers` table hasn't been seeded —
// with global.fetch mocked (no real network call, no real API quota
// spent). `../config/sequelize` is mocked to force that "empty table"
// condition deterministically, since the real dev database has the table
// seeded (18k+ real players via src/seed/cricketersSeed.ts) and this test
// would otherwise silently exercise the wrong code path depending on
// whether someone happened to run that seed script.

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

import { searchCricketers, _clearRapidApiCacheForTests } from '../services/cricketerSearchService';

const ROSTER_BY_TEAM: Record<number, unknown> = {
  2: {
    status: 'success',
    response: [
      { id: '1413', slug: 'virat-kohli', title: 'Virat Kohli', image: 'https://x/kohli.jpg' },
      { id: '576', slug: 'rohit-sharma', title: 'Rohit Sharma', image: 'https://x/rohit.jpg' },
    ],
  },
  3: {
    status: 'success',
    response: [
      { id: '9001', slug: 'babar-azam', title: 'Babar Azam', image: 'https://x/babar.jpg' },
    ],
  },
  4: { status: 'success', response: [] },
  9: { status: 'success', response: [] },
  11: { status: 'success', response: [] },
  13: {
    status: 'success',
    // Same player id as an already-seen one, to exercise de-duping.
    response: [
      { id: '1413', slug: 'virat-kohli', title: 'Virat Kohli', image: 'https://x/kohli.jpg' },
    ],
  },
};

describe('searchCricketers (RapidAPI-backed)', () => {
  const originalRapidApiKey = process.env.RAPIDAPI_KEY;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-rapidapi-key';
    process.env.RAPIDAPI_HOST = 'cricket-api-free-data.p.rapidapi.com';
    _clearRapidApiCacheForTests();

    fetchMock = jest.fn(async (url: string) => {
      const teamId = Number(new URL(url).searchParams.get('teamid'));
      return {
        ok: true,
        status: 200,
        json: async () => ROSTER_BY_TEAM[teamId],
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    if (originalRapidApiKey) {
      process.env.RAPIDAPI_KEY = originalRapidApiKey;
    } else {
      delete process.env.RAPIDAPI_KEY;
    }
  });

  it('filters the merged roster by substring match, case-insensitively', async () => {
    const results = await searchCricketers('kohli');
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      name: 'Virat Kohli',
      external_id: 'rapidapi-1413',
      photo_url: 'https://x/kohli.jpg',
    });
  });

  it('de-dupes a player who appears on more than one fetched roster', async () => {
    const results = await searchCricketers('');
    const kohliEntries = results.filter((c) => c.external_id === 'rapidapi-1413');
    expect(kohliEntries).toHaveLength(1);
    expect(results).toHaveLength(3); // Kohli, Rohit, Babar — deduped
  });

  it('caches the merged roster instead of refetching on every search', async () => {
    await searchCricketers('kohli');
    await searchCricketers('babar');
    await searchCricketers('rohit');

    // 6 curated team ids fetched once, not once per search call.
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('returns an empty array for a query matching nothing', async () => {
    const results = await searchCricketers('zzzznotaplayer');
    expect(results).toEqual([]);
  });
});
