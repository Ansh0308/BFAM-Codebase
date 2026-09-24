// Long tail — Special Recognition (PRD §12.39): pure award selection +
// GET /recognition. Only `sequelize` is faked.

const USER_ID = 'aaaaaaaa-0000-4000-8000-002401';

let rows: Array<Record<string, unknown>>;
let lastReplacements: Record<string, unknown> | undefined;

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      if (sql.includes('FROM player_match_statistics s')) {
        lastReplacements = options.replacements;
        return rows;
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

import request from 'supertest';
import app from '../app';
import {
  monthRange,
  pickMonthlyAwards,
  type MonthlyPlayerRow,
} from '../services/recognitionService';

async function token() {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: USER_ID });
  return res.body.token as string;
}

const p = (over: Partial<MonthlyPlayerRow> & { player_id: string }): MonthlyPlayerRow => ({
  bfam_id: over.player_id,
  full_name: null,
  runs: 0,
  wickets: 0,
  matches: 1,
  fair_play_rating: 3,
  ...over,
});

describe('pickMonthlyAwards', () => {
  it('picks each star and weighs wickets 20x for Player of the Month', () => {
    const awards = pickMonthlyAwards([
      p({ player_id: 'bat', runs: 150, wickets: 0 }),
      p({ player_id: 'bowl', runs: 0, wickets: 8 }),
      p({ player_id: 'all', runs: 90, wickets: 5 }),
    ]);
    const by = Object.fromEntries(awards.map((a) => [a.award, a]));
    expect(by.BATTING_STAR.player_id).toBe('bat');
    expect(by.BOWLING_STAR.player_id).toBe('bowl');
    // bat=150, bowl=160, all=190
    expect(by.PLAYER_OF_THE_MONTH.player_id).toBe('all');
    expect(by.PLAYER_OF_THE_MONTH.value).toBe(190);
  });

  it('gives no batting/bowling star when nobody scored or took a wicket', () => {
    const awards = pickMonthlyAwards([p({ player_id: 'a' })]);
    expect(awards.map((a) => a.award)).toEqual(['SPORTSMAN_OF_THE_MONTH']);
  });

  it('awards Sportsman by fair-play rating, ties to more matches', () => {
    const awards = pickMonthlyAwards([
      p({ player_id: 'x', fair_play_rating: 4.5, matches: 1 }),
      p({ player_id: 'y', fair_play_rating: 4.5, matches: 3 }),
      p({ player_id: 'z', fair_play_rating: 4.0, matches: 9 }),
    ]);
    expect(awards.find((a) => a.award === 'SPORTSMAN_OF_THE_MONTH')?.player_id).toBe('y');
  });

  it('returns nothing for an empty month', () => {
    expect(pickMonthlyAwards([])).toEqual([]);
  });
});

describe('monthRange', () => {
  it('spans a calendar month in UTC, including the year rollover', () => {
    expect(monthRange('2026-12')).toEqual({
      start: new Date('2026-12-01T00:00:00Z'),
      end: new Date('2027-01-01T00:00:00Z'),
    });
  });
  it('rejects malformed input', () => {
    expect(monthRange('2026-13')).toBeNull();
    expect(monthRange('abc')).toBeNull();
  });
});

describe('GET /recognition', () => {
  beforeEach(() => {
    lastReplacements = undefined;
    rows = [
      {
        player_id: 'a',
        bfam_id: 'BF1',
        full_name: 'A',
        runs: '120',
        wickets: '2',
        matches: '3',
        fair_play_rating: '4.2',
      },
    ];
  });

  it('returns the month awards, coercing DB string aggregates', async () => {
    const res = await request(app)
      .get('/recognition?month=2026-09')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-09');
    expect(res.body.awards.find((a: { award: string }) => a.award === 'BATTING_STAR').value).toBe(
      120,
    );
    expect(new Date(lastReplacements!.start as Date).toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    );
  });

  it('400s a malformed month', async () => {
    const res = await request(app)
      .get('/recognition?month=nope')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/recognition')).status).toBe(401);
  });
});
