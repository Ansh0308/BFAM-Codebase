// Exercises GET /leaderboards (long tail — Rankings & Leaderboards, PRD
// §12.33). Only `sequelize` is faked — the real routes/services run
// unmodified.

interface StatRow {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  runs_scored: number;
  balls_faced: number;
  sixes: number;
  wickets_taken: number;
  overs_bowled: number;
  runs_conceded: number;
}

interface PlayerRow {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  skill_rating: number;
  fair_play_rating: number;
  reliability_score: number;
}

const PLAYER_ID = 'aaaaaaaa-0000-4000-8000-001401';

let statRows: StatRow[];
let players: PlayerRow[];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        if (sql.includes('FROM player_match_statistics s')) {
          return statRows;
        }
        if (sql.includes('FROM players') && sql.includes('ORDER BY')) {
          const column = sql.includes('skill_rating')
            ? 'skill_rating'
            : sql.includes('fair_play_rating')
              ? 'fair_play_rating'
              : 'reliability_score';
          const limit = Number(options.replacements?.limit ?? 20);
          return [...players]
            .sort(
              (a, b) =>
                (b[column as keyof PlayerRow] as number) - (a[column as keyof PlayerRow] as number),
            )
            .slice(0, limit)
            .map((p) => ({
              player_id: p.player_id,
              bfam_id: p.bfam_id,
              full_name: p.full_name,
              value: p[column as keyof PlayerRow],
            }));
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('GET /leaderboards (long tail — Rankings & Leaderboards)', () => {
  beforeEach(() => {
    statRows = [
      {
        player_id: 'p1',
        bfam_id: 'BF1001',
        full_name: 'Asha Patel',
        runs_scored: 100,
        balls_faced: 60,
        sixes: 5,
        wickets_taken: 1,
        overs_bowled: 6.0,
        runs_conceded: 60,
      },
      {
        player_id: 'p2',
        bfam_id: 'BF1002',
        full_name: 'Rohan Mehta',
        runs_scored: 40,
        balls_faced: 30,
        sixes: 1,
        wickets_taken: 5,
        overs_bowled: 8.0,
        runs_conceded: 30,
      },
    ];
    players = [
      {
        player_id: 'p1',
        bfam_id: 'BF1001',
        full_name: 'Asha Patel',
        skill_rating: 650,
        fair_play_rating: 90,
        reliability_score: 95,
      },
      {
        player_id: 'p2',
        bfam_id: 'BF1002',
        full_name: 'Rohan Mehta',
        skill_rating: 700,
        fair_play_rating: 85,
        reliability_score: 80,
      },
    ];
  });

  it('ranks MOST_RUNS descending', async () => {
    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .get('/leaderboards?category=MOST_RUNS')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.category).toBe('MOST_RUNS');
    expect(res.body.results[0]).toMatchObject({ rank: 1, player_id: 'p1', value: 100 });
    expect(res.body.results[1]).toMatchObject({ rank: 2, player_id: 'p2', value: 40 });
  });

  it('ranks MOST_WICKETS descending', async () => {
    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .get('/leaderboards?category=MOST_WICKETS')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.results[0]).toMatchObject({ player_id: 'p2', value: 5 });
  });

  it('excludes a player below the qualifying minimum for BEST_STRIKE_RATE', async () => {
    // p2 only faced 30 balls (below the 30-ball minimum is actually equal —
    // use a genuinely-below-threshold row to make the exclusion clear).
    statRows[1].balls_faced = 10;

    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .get('/leaderboards?category=BEST_STRIKE_RATE')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].player_id).toBe('p1');
  });

  it('ranks BEST_ECONOMY with lower being better', async () => {
    // p1: 60 conceded / 36 legal balls = 10.0 economy. p2: 30 conceded / 48
    // legal balls = 3.75 economy — p2 should rank first (lower economy).
    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .get('/leaderboards?category=BEST_ECONOMY')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.results[0]).toMatchObject({ player_id: 'p2', value: 3.75 });
    expect(res.body.results[1]).toMatchObject({ player_id: 'p1', value: 10 });
  });

  it('ranks HIGHEST_SKILL_RATING from the players table directly', async () => {
    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .get('/leaderboards?category=HIGHEST_SKILL_RATING')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.results[0]).toMatchObject({ player_id: 'p2', value: 700 });
    expect(res.body.results[1]).toMatchObject({ player_id: 'p1', value: 650 });
  });

  it('ranks FAIR_PLAY and RELIABILITY too', async () => {
    const token = await tokenFor(PLAYER_ID);
    const fairPlay = await request(app)
      .get('/leaderboards?category=FAIR_PLAY')
      .set('Authorization', `Bearer ${token}`);
    expect(fairPlay.body.results[0]).toMatchObject({ player_id: 'p1', value: 90 });

    const reliability = await request(app)
      .get('/leaderboards?category=RELIABILITY')
      .set('Authorization', `Bearer ${token}`);
    expect(reliability.body.results[0]).toMatchObject({ player_id: 'p1', value: 95 });
  });

  it('rejects an invalid category', async () => {
    const token = await tokenFor(PLAYER_ID);
    const res = await request(app)
      .get('/leaderboards?category=NOT_A_CATEGORY')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/leaderboards?category=MOST_RUNS');
    expect(res.status).toBe(401);
  });
});
