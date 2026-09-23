// Backlog A-15: My Matches split into Upcoming/Past — listMyMatches grew a
// scope param, status-based (not a pure time comparison) same convention
// as listBookingsForUser, so an overdue-but-not-yet-started/cancelled
// match still reads as "upcoming" instead of silently vanishing into Past.

const USER_ID = 'user-1';
const PLAYER_ID = 'player-1';

const MATCHES = [
  { match_id: 'm-open', match_status: 'OPEN' },
  { match_id: 'm-confirmed', match_status: 'CONFIRMED' },
  { match_id: 'm-in-progress', match_status: 'IN_PROGRESS' },
  { match_id: 'm-completed', match_status: 'COMPLETED' },
  { match_id: 'm-cancelled', match_status: 'CANCELLED' },
];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          return r.userId === USER_ID ? [{ player_id: PLAYER_ID }] : [];
        }
        if (sql.includes('FROM matches m')) {
          // The real query filters in SQL — this fake just returns
          // everything and lets the assertions below check which WHERE
          // clause was actually sent, since that's what determines
          // correctness against a real database.
          if (sql.includes("m.match_status NOT IN ('COMPLETED', 'CANCELLED')")) {
            return MATCHES.filter((m) => !['COMPLETED', 'CANCELLED'].includes(m.match_status));
          }
          if (sql.includes("m.match_status IN ('COMPLETED', 'CANCELLED')")) {
            return MATCHES.filter((m) => ['COMPLETED', 'CANCELLED'].includes(m.match_status));
          }
          return MATCHES;
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
    },
  };
});

import { listMyMatches } from '../services/matchService';

describe('listMyMatches — Upcoming/Past scope (backlog A-15)', () => {
  it('"upcoming" excludes COMPLETED and CANCELLED matches', async () => {
    const results = await listMyMatches(USER_ID, 'upcoming');

    expect(results.map((m) => m.match_id).sort()).toEqual(
      ['m-confirmed', 'm-in-progress', 'm-open'].sort(),
    );
  });

  it('"past" includes only COMPLETED and CANCELLED matches', async () => {
    const results = await listMyMatches(USER_ID, 'past');

    expect(results.map((m) => m.match_id).sort()).toEqual(['m-cancelled', 'm-completed'].sort());
  });

  it('"all" (the default) returns every match, unchanged from before this backlog item', async () => {
    const results = await listMyMatches(USER_ID);

    expect(results).toHaveLength(5);
  });
});
