// A-26: "clicking Start Match again shouldn't restart the whole setup".
// startIntro was already idempotent about the match_intro *row* (an
// isFirstStart guard already existed), but it unconditionally broadcast
// COUNTDOWN to every connected client on every call — re-entering (a
// second Start Match tap, or the organizer's app backgrounding and
// reopening /intro) forced every other viewer's screen back to the start,
// even mid-toss or mid-innings, purely because one person re-opened the
// screen. This also checks match_status actually transitions to
// IN_PROGRESS on the real first start — it was defined in the schema but
// nothing ever set it.

const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000001701';
const ORGANIZER_USER = 'bbbbbbbb-0000-4000-8000-000000001702';

let introExists: boolean;
const match = {
  match_id: MATCH_ID,
  booking_id: 'booking-1',
  match_name: 'Sunday Cricket',
  organizer_id: ORGANIZER_USER,
  assigned_scorer_id: null,
};

const mockEmit = jest.fn();
jest.mock('../realtime/io', () => ({
  getIo: () => ({ to: () => ({ emit: mockEmit }) }),
  matchRoom: (matchId: string) => `match:${matchId}`,
}));

jest.mock('../services/followService', () => ({
  notifyFollowersOfMatchStart: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/notificationService', () => ({
  sendNotificationToMany: jest.fn().mockResolvedValue(undefined),
}));

const matchUpdates: Record<string, unknown>[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM matches WHERE match_id')) {
          return match.match_id === r.matchId ? [match] : [];
        }
        if (sql.includes('SELECT * FROM match_intro WHERE match_id')) {
          return introExists ? [{ intro_id: 'intro-1', match_id: MATCH_ID }] : [];
        }
        if (sql.includes('mp.player_id, p.bfam_id, p.full_name, mp.participant_role')) {
          return [];
        }
        if (sql.includes('SELECT match_team_id, side_label FROM match_teams')) return [];
        if (sql.includes('SELECT t.stadium_sound_enabled'))
          return [{ stadium_sound_enabled: true }];
        if (sql.includes('SELECT p.user_id FROM match_players mp')) return [];
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async () => undefined,
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'matches') matchUpdates.push({ ...values, ...where });
        },
      }),
    },
  };
});

import { startIntro } from '../services/matchIntroService';

describe('startIntro re-entry does not reset everyone back to COUNTDOWN (backlog A-26)', () => {
  beforeEach(() => {
    introExists = false;
    mockEmit.mockClear();
    matchUpdates.length = 0;
  });

  it('broadcasts COUNTDOWN and sets match_status IN_PROGRESS on the actual first start', async () => {
    await startIntro(MATCH_ID, ORGANIZER_USER);

    expect(mockEmit).toHaveBeenCalledWith(
      'match:intro_stage',
      expect.objectContaining({ matchId: MATCH_ID, stage: 'COUNTDOWN' }),
    );
    expect(matchUpdates).toContainEqual({
      match_status: 'IN_PROGRESS',
      match_id: MATCH_ID,
    });
  });

  it('does not re-broadcast COUNTDOWN on a resumed re-entry', async () => {
    introExists = true; // simulates re-entering an already-started intro

    await startIntro(MATCH_ID, ORGANIZER_USER);

    expect(mockEmit).not.toHaveBeenCalled();
    // Re-entry never touches match_status either — it's already set.
    expect(matchUpdates).toHaveLength(0);
  });

  it('still returns the current intro/players/matchTeams on a re-entry, for the caller to resolve its own resume point', async () => {
    introExists = true;

    const result = await startIntro(MATCH_ID, ORGANIZER_USER);

    expect(result.intro).toEqual({ intro_id: 'intro-1', match_id: MATCH_ID });
    expect(result.players).toEqual([]);
    expect(result.matchTeams).toEqual([]);
  });
});
