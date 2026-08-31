// Exercises the local `cricketers`-table-backed search path — the primary
// path once the table has been seeded (see src/seed/cricketersSeed.ts).
// `../config/sequelize` is faked with a small in-memory table rather than
// hitting the real dev database, so this stays hermetic regardless of
// whether the real seed script has been run.

interface FakeCricketerRow {
  external_id: string;
  display_name: string;
  jersey_number: string | null;
}

const TABLE: FakeCricketerRow[] = [
  { external_id: 'cricsheet-ba607b88', display_name: 'Virat Kohli', jersey_number: '18' },
  { external_id: 'cricsheet-4a8a2e3b', display_name: 'MS Dhoni', jersey_number: '7' },
  { external_id: 'cricsheet-d2c2b2d5', display_name: 'SR Tendulkar', jersey_number: null },
  { external_id: 'cricsheet-73d630e7', display_name: 'DG Bradman', jersey_number: null },
];

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      if (sql.includes('SELECT COUNT(*) AS cnt FROM cricketers')) {
        return [{ cnt: TABLE.length }];
      }
      if (
        sql.includes('SELECT external_id, display_name FROM cricketers WHERE display_name LIKE')
      ) {
        const needle = String(options.replacements?.needle ?? '')
          .replace(/%/g, '')
          .toLowerCase();
        return TABLE.filter((r) => r.display_name.toLowerCase().includes(needle)).map((r) => ({
          external_id: r.external_id,
          display_name: r.display_name,
        }));
      }
      if (sql.includes('SELECT external_id, display_name FROM cricketers ORDER BY')) {
        return TABLE.map((r) => ({ external_id: r.external_id, display_name: r.display_name }));
      }
      if (sql.includes('SELECT jersey_number FROM cricketers WHERE external_id')) {
        const match = TABLE.find((r) => r.external_id === options.replacements?.externalId);
        return match ? [{ jersey_number: match.jersey_number }] : [];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

import { searchCricketers, lookupJerseyNumber } from '../services/cricketerSearchService';

describe('searchCricketers (local cricketers-table path)', () => {
  const originalRapidApiKey = process.env.RAPIDAPI_KEY;

  beforeEach(() => {
    delete process.env.RAPIDAPI_KEY;
  });

  afterAll(() => {
    if (originalRapidApiKey) process.env.RAPIDAPI_KEY = originalRapidApiKey;
  });

  it('finds a well-known current player', async () => {
    const results = await searchCricketers('Kohli');
    expect(results).toEqual([
      { name: 'Virat Kohli', external_id: 'cricsheet-ba607b88', photo_url: null },
    ]);
  });

  it('finds an all-time historical player no live cricket API would ever return', async () => {
    const results = await searchCricketers('Bradman');
    expect(results).toEqual([
      { name: 'DG Bradman', external_id: 'cricsheet-73d630e7', photo_url: null },
    ]);
  });

  it('returns everything for an empty query', async () => {
    const results = await searchCricketers('');
    expect(results).toHaveLength(4);
  });

  it('returns an empty array for a query matching nothing', async () => {
    const results = await searchCricketers('zzzznotaplayer');
    expect(results).toEqual([]);
  });
});

describe('lookupJerseyNumber (local cricketers-table path)', () => {
  it('resolves a curated jersey number', async () => {
    await expect(lookupJerseyNumber('cricsheet-ba607b88')).resolves.toBe('18');
  });

  it('returns null for a player with no curated jersey number', async () => {
    await expect(lookupJerseyNumber('cricsheet-d2c2b2d5')).resolves.toBeNull();
  });

  it('returns null for an unrecognized external_id', async () => {
    await expect(lookupJerseyNumber('cricsheet-doesnotexist')).resolves.toBeNull();
  });

  it('returns null for a null/undefined external_id', async () => {
    await expect(lookupJerseyNumber(null)).resolves.toBeNull();
    await expect(lookupJerseyNumber(undefined)).resolves.toBeNull();
  });
});
