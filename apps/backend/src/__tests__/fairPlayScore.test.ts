// Unit test for backlog B-5's Open Teams aggregate: listOpenTeams should
// surface each team's Fair Play score (average reliability_score across
// active members), rounded, with null (not NaN or "0") for a team with no
// active members — MySQL's AVG() over an empty group returns NULL, and raw
// sequelize.query returns DECIMAL columns as strings (same quirk already
// documented elsewhere in this codebase).

const query = jest.fn();
jest.mock('../config/sequelize', () => ({
  sequelize: { query: (...args: unknown[]) => query(...args) },
}));

import { listOpenTeams } from '../services/teamService';

describe('listOpenTeams — Fair Play score (backlog B-5)', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('rounds a string-typed AVG() result to a whole number', async () => {
    query.mockResolvedValueOnce([
      {
        team_id: 't1',
        team_name: 'Rajkot Strikers',
        active_member_count: 5,
        fair_play_score: '87.3333',
      },
    ]);

    const [team] = await listOpenTeams({});
    expect(team.fair_play_score).toBe(87);
  });

  it('passes through null for a team with no active members', async () => {
    query.mockResolvedValueOnce([
      { team_id: 't2', team_name: 'Empty Team', active_member_count: 0, fair_play_score: null },
    ]);

    const [team] = await listOpenTeams({});
    expect(team.fair_play_score).toBeNull();
  });
});
