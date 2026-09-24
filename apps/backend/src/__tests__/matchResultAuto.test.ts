// Automatic match finalization + named result (see
// .claude/MATCH_REVAMP_PLAN.md). Only `sequelize` and the two side-effect
// services are faked — the real routes/scoringService run unmodified.

const ORGANIZER = 'aaaaaaaa-0000-4000-8000-002601';
const OTHER = 'aaaaaaaa-0000-4000-8000-002602';
const MATCH_ID = 'bbbbbbbb-0000-4000-8000-002603';
const MT_A = 'cccccccc-0000-4000-8000-00260a';
const MT_B = 'cccccccc-0000-4000-8000-00260b';

let resultRows: Array<Record<string, unknown>>;
let inserted: Array<{ table: string; rows: Array<Record<string, unknown>> }>;
let updates: Array<{ table: string; values: Record<string, unknown> }>;

const event = (striker: string, bowler: string, runs: number, wicket = false) => ({
  score_event_id: `e-${Math.random()}`,
  over_number: 0,
  ball_number_in_over: 1,
  sequence_number: 1,
  striker_player_id: striker,
  striker_bfam_id: striker,
  striker_full_name: striker,
  bowler_player_id: bowler,
  bowler_bfam_id: bowler,
  bowler_full_name: bowler,
  runs_scored: runs,
  extra_type: 'NONE',
  extra_runs: 0,
  is_wicket: wicket,
  wicket_type: wicket ? 'BOWLED' : null,
  dismissed_player_id: wicket ? striker : null,
});

jest.mock('../services/statisticsService', () => ({
  materializeMatchStatistics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/notificationService', () => ({
  sendNotificationToMany: jest.fn().mockResolvedValue(undefined),
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      if (sql.includes('SELECT match_name FROM matches')) return [{ match_name: 'Derby' }];
      if (sql.includes('FROM matches WHERE match_id')) {
        return r.matchId === MATCH_ID
          ? [
              {
                match_id: MATCH_ID,
                organizer_id: ORGANIZER,
                assigned_scorer_id: null,
                scoring_mode: 'PLAYER_MANAGED',
                match_status: 'IN_PROGRESS',
                extras_count_toward_score: true,
                overs_per_innings: 6,
                no_non_striker: false,
              },
            ]
          : [];
      }
      if (sql.includes('SELECT result_id FROM match_results')) {
        return resultRows.map((x) => ({ result_id: x.result_id }));
      }
      if (sql.includes('FROM match_results r')) {
        return resultRows.map((x) => ({
          ...x,
          player_of_the_match_bfam_id: 'BF-A1',
          player_of_the_match_name: 'Asha Rao',
        }));
      }
      if (sql.includes('FROM player_match_statistics')) {
        return [{ runs_scored: 6, balls_faced: 1, wickets_taken: 1, runs_conceded: 2 }];
      }
      if (sql.includes('FROM innings WHERE match_id')) {
        return [
          {
            innings_id: 'i1',
            innings_number: 1,
            batting_match_team_id: MT_A,
            bowling_match_team_id: MT_B,
            total_runs: 100,
            total_wickets: 5,
            overs_completed: 6,
          },
          {
            innings_id: 'i2',
            innings_number: 2,
            batting_match_team_id: MT_B,
            bowling_match_team_id: MT_A,
            total_runs: 90,
            total_wickets: 8,
            overs_completed: 6,
          },
        ];
      }
      if (sql.includes('COUNT(*) AS count FROM match_players')) return [{ count: 8 }];
      if (sql.includes('SELECT player_id, match_team_id FROM match_players')) {
        return [
          { player_id: 'a1', match_team_id: MT_A },
          { player_id: 'b1', match_team_id: MT_B },
        ];
      }
      if (sql.includes('FROM score_events se')) {
        return r.inningsId === 'i1' ? [event('a1', 'b1', 6)] : [event('b1', 'a1', 2, true)];
      }
      if (sql.includes('FROM match_teams mt')) {
        return [
          { match_team_id: MT_A, side_label: 'TEAM_A', team_name: 'Royals' },
          { match_team_id: MT_B, side_label: 'TEAM_B', team_name: null },
        ];
      }
      if (sql.includes('FROM match_players mp')) return [{ user_id: ORGANIZER }];
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
    getQueryInterface: () => ({
      bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
        inserted.push({ table, rows });
        if (table === 'match_results') resultRows.push(...rows);
      },
      bulkUpdate: async (table: string, values: Record<string, unknown>) => {
        updates.push({ table, values });
      },
    }),
  },
}));

import request from 'supertest';
import app from '../app';

async function token(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('POST /matches/:matchId/result — automatic finalization', () => {
  beforeEach(() => {
    resultRows = [];
    inserted = [];
    updates = [];
  });

  it('works out the winner, margin and Player of the Match from the scorecard', async () => {
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/result`)
      .set('Authorization', `Bearer ${await token(ORGANIZER)}`)
      .send({});
    expect(res.status).toBe(201);

    const row = inserted.find((i) => i.table === 'match_results')!.rows[0];
    expect(row).toMatchObject({
      result_type: 'WIN',
      winning_match_team_id: MT_A,
      winning_margin: '10 runs',
      // a1 = 6 runs + 1 wicket (20) beats b1's 2 runs
      player_of_the_match_id: 'a1',
    });
    expect(
      updates.some((u) => u.table === 'matches' && u.values.match_status === 'COMPLETED'),
    ).toBe(true);
  });

  it('is idempotent — a second call returns the existing result without inserting again', async () => {
    const auth = `Bearer ${await token(ORGANIZER)}`;
    const first = await request(app)
      .post(`/matches/${MATCH_ID}/result`)
      .set('Authorization', auth)
      .send({});
    const second = await request(app)
      .post(`/matches/${MATCH_ID}/result`)
      .set('Authorization', auth)
      .send({});
    expect(second.status).toBe(201);
    expect(second.body.result_id).toBe(first.body.result_id);
    expect(inserted.filter((i) => i.table === 'match_results')).toHaveLength(1);
  });

  it('still honours an explicit override', async () => {
    await request(app)
      .post(`/matches/${MATCH_ID}/result`)
      .set('Authorization', `Bearer ${await token(ORGANIZER)}`)
      .send({ result_type: 'TIE' });
    expect(inserted.find((i) => i.table === 'match_results')!.rows[0]).toMatchObject({
      result_type: 'TIE',
      winning_match_team_id: null,
    });
  });

  it('forbids someone who is not the organizer or scorer', async () => {
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/result`)
      .set('Authorization', `Bearer ${await token(OTHER)}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('GET /matches/:matchId/result', () => {
  it('returns the winning team NAME and the Player of the Match by name with their line', async () => {
    resultRows = [
      {
        result_id: 'r1',
        match_id: MATCH_ID,
        winning_match_team_id: MT_A,
        result_type: 'WIN',
        winning_margin: '10 runs',
        player_of_the_match_id: 'a1',
      },
    ];
    const res = await request(app)
      .get(`/matches/${MATCH_ID}/result`)
      .set('Authorization', `Bearer ${await token(ORGANIZER)}`);
    expect(res.status).toBe(200);
    expect(res.body.winning_team_name).toBe('Royals');
    expect(res.body.player_of_the_match_name).toBe('Asha Rao');
    expect(res.body.player_of_the_match_stats).toEqual({
      runs: 6,
      balls: 1,
      wickets: 1,
      runs_conceded: 2,
    });
  });
});
