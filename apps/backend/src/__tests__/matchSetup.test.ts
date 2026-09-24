// PATCH /matches/:matchId/setup — Match Setup (team names, overs, rules).
// Only `sequelize` is faked; the real route/service run unmodified.

const ORGANIZER = 'aaaaaaaa-0000-4000-8000-002701';
const OTHER = 'aaaaaaaa-0000-4000-8000-002702';
const MATCH_ID = 'bbbbbbbb-0000-4000-8000-002703';
const MT_A = 'cccccccc-0000-4000-8000-00000000270a';
const MT_B = 'cccccccc-0000-4000-8000-00000000270b';

let inningsCount: number;
let updates: Array<{
  table: string;
  values: Record<string, unknown>;
  where: Record<string, unknown>;
}>;

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      if (sql.includes('FROM matches WHERE match_id')) {
        return r.matchId === MATCH_ID
          ? [
              {
                match_id: MATCH_ID,
                booking_id: 'bk',
                match_name: 'Derby',
                organizer_id: ORGANIZER,
                assigned_scorer_id: null,
              },
            ]
          : [];
      }
      if (sql.includes('COUNT(*) AS count FROM innings')) return [{ count: inningsCount }];
      if (sql.includes('FROM match_teams mt')) {
        return [
          { match_team_id: MT_A, side_label: 'TEAM_A', team_name: 'Royals' },
          { match_team_id: MT_B, side_label: 'TEAM_B', team_name: null },
        ];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
    getQueryInterface: () => ({
      bulkUpdate: async (
        table: string,
        values: Record<string, unknown>,
        where: Record<string, unknown>,
      ) => {
        updates.push({ table, values, where });
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

describe('PATCH /matches/:matchId/setup', () => {
  beforeEach(() => {
    inningsCount = 0;
    updates = [];
  });

  it('saves side names (trimmed, blank -> null), overs and both rules', async () => {
    const res = await request(app)
      .patch(`/matches/${MATCH_ID}/setup`)
      .set('Authorization', `Bearer ${await token(ORGANIZER)}`)
      .send({
        team_names: [
          { match_team_id: MT_A, team_name: '  Royals  ' },
          { match_team_id: MT_B, team_name: '   ' },
        ],
        overs_per_innings: 10,
        no_non_striker: false,
        extras_count_toward_score: false,
      });

    expect(res.status).toBe(200);
    const matchUpdate = updates.find((u) => u.table === 'matches')!;
    expect(matchUpdate.values).toMatchObject({
      overs_per_innings: 10,
      no_non_striker: false,
      extras_count_toward_score: false,
    });
    const teamUpdates = updates.filter((u) => u.table === 'match_teams');
    expect(teamUpdates.map((u) => u.values.team_name)).toEqual(['Royals', null]);
    expect(res.body.matchTeams).toHaveLength(2);
  });

  it('refuses once scoring has started', async () => {
    inningsCount = 1;
    const res = await request(app)
      .patch(`/matches/${MATCH_ID}/setup`)
      .set('Authorization', `Bearer ${await token(ORGANIZER)}`)
      .send({ overs_per_innings: 8 });
    expect(res.status).toBe(409);
    expect(updates).toHaveLength(0);
  });

  it('rejects a side that does not belong to the match', async () => {
    const res = await request(app)
      .patch(`/matches/${MATCH_ID}/setup`)
      .set('Authorization', `Bearer ${await token(ORGANIZER)}`)
      .send({
        team_names: [{ match_team_id: 'dddddddd-0000-4000-8000-00000000270c', team_name: 'X' }],
      });
    expect(res.status).toBe(409);
  });

  it('validates the payload', async () => {
    const res = await request(app)
      .patch(`/matches/${MATCH_ID}/setup`)
      .set('Authorization', `Bearer ${await token(ORGANIZER)}`)
      .send({ overs_per_innings: 0 });
    expect(res.status).toBe(400);
  });

  it('forbids someone who is not the organizer or scorer', async () => {
    const res = await request(app)
      .patch(`/matches/${MATCH_ID}/setup`)
      .set('Authorization', `Bearer ${await token(OTHER)}`)
      .send({ overs_per_innings: 8 });
    expect(res.status).toBe(403);
  });
});
