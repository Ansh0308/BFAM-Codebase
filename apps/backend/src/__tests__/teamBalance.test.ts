// Long tail — skill-aware team balancing (PRD §12.28): pure balancer +
// GET /matches/:matchId/balanced-teams. Only `sequelize` is faked.

const ORGANIZER = 'aaaaaaaa-0000-4000-8000-002501';
const OTHER_USER = 'aaaaaaaa-0000-4000-8000-002502';
const MATCH_ID = 'bbbbbbbb-0000-4000-8000-002503';

let roster: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      if (sql.includes('SELECT * FROM matches WHERE match_id')) {
        return r.matchId === MATCH_ID
          ? [{ match_id: MATCH_ID, organizer_id: ORGANIZER, assigned_scorer_id: null }]
          : [];
      }
      if (sql.includes('FROM match_players mp') && sql.includes('JOIN players p')) {
        return roster;
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

import request from 'supertest';
import app from '../app';
import { balanceTeams, type BalanceCandidate } from '../domain/teamBalance';

async function token(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

const c = (id: string, skill: number, role: string | null = 'BATTER'): BalanceCandidate => ({
  player_id: id,
  skill_rating: skill,
  playing_role: role,
});

describe('balanceTeams', () => {
  it('keeps team sizes within one and every player assigned exactly once', () => {
    const players = [700, 650, 600, 550, 500, 450, 400].map((s, i) => c(`p${i}`, s));
    const { team_a, team_b } = balanceTeams(players);
    expect(Math.abs(team_a.length - team_b.length)).toBeLessThanOrEqual(1);
    expect([...team_a, ...team_b].sort()).toEqual(players.map((p) => p.player_id).sort());
  });

  it('splits strength closely, not just by count', () => {
    const players = [900, 800, 300, 200, 100, 100].map((s, i) => c(`p${i}`, s));
    const { strength_a, strength_b } = balanceTeams(players);
    // Best possible split of 2400 is 1200/1200; greedy must be far better
    // than the naive first-half/second-half split (2000 vs 400).
    expect(Math.abs(strength_a - strength_b)).toBeLessThanOrEqual(200);
  });

  it('spreads playing roles when strengths tie', () => {
    const { team_a, team_b } = balanceTeams([
      c('k1', 500, 'WICKET_KEEPER'),
      c('k2', 500, 'WICKET_KEEPER'),
      c('b1', 500, 'BOWLER'),
      c('b2', 500, 'BOWLER'),
    ]);
    const hasKeeper = (ids: string[]) => ids.some((id) => id.startsWith('k'));
    expect(hasKeeper(team_a)).toBe(true);
    expect(hasKeeper(team_b)).toBe(true);
  });

  it('is deterministic and handles empty / single-player rosters', () => {
    const players = [c('a', 500), c('b', 500), c('c', 500)];
    expect(balanceTeams(players)).toEqual(balanceTeams([...players].reverse()));
    expect(balanceTeams([])).toEqual({ team_a: [], team_b: [], strength_a: 0, strength_b: 0 });
    expect(balanceTeams([c('solo', 400)]).team_a).toEqual(['solo']);
  });
});

describe('GET /matches/:matchId/balanced-teams', () => {
  beforeEach(() => {
    roster = [
      {
        player_id: 'p1',
        bfam_id: 'BF1',
        full_name: 'One',
        skill_rating: 700,
        playing_role: 'BATTER',
      },
      {
        player_id: 'p2',
        bfam_id: 'BF2',
        full_name: 'Two',
        skill_rating: 600,
        playing_role: 'BOWLER',
      },
      {
        player_id: 'p3',
        bfam_id: 'BF3',
        full_name: 'Three',
        skill_rating: 500,
        playing_role: 'BATTER',
      },
      {
        player_id: 'p4',
        bfam_id: 'BF4',
        full_name: 'Four',
        skill_rating: 400,
        playing_role: 'BOWLER',
      },
    ];
  });

  it('returns two balanced sides for the organizer', async () => {
    const res = await request(app)
      .get(`/matches/${MATCH_ID}/balanced-teams`)
      .set('Authorization', `Bearer ${await token(ORGANIZER)}`);
    expect(res.status).toBe(200);
    expect(res.body.team_a).toHaveLength(2);
    expect(res.body.team_b).toHaveLength(2);
    expect(res.body.strength_a).toBe(1100);
    expect(res.body.strength_b).toBe(1100);
  });

  it('forbids someone who is not organizer or scorer', async () => {
    const res = await request(app)
      .get(`/matches/${MATCH_ID}/balanced-teams`)
      .set('Authorization', `Bearer ${await token(OTHER_USER)}`);
    expect(res.status).toBe(403);
  });

  it('404s an unknown match', async () => {
    const res = await request(app)
      .get('/matches/nope/balanced-teams')
      .set('Authorization', `Bearer ${await token(ORGANIZER)}`);
    expect(res.status).toBe(404);
  });
});
