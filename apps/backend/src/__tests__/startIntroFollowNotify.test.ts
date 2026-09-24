// Integration test for backlog B-9's wiring point: matchIntroService's
// startIntro should call followService.notifyFollowersOfMatchStart with
// the confirmed roster, only on the actual first start (not a resumed
// re-entry). followService itself is unit-tested separately
// (followService.test.ts) — this only checks the wiring.

const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000001601';
const ORGANIZER_USER = 'bbbbbbbb-0000-4000-8000-000000001602';
const PLAYER_1 = 'cccccccc-0000-4000-8000-000000001603';

let introExists: boolean;
const match = {
  match_id: MATCH_ID,
  booking_id: 'booking-1',
  match_name: 'Sunday Cricket',
  organizer_id: ORGANIZER_USER,
  assigned_scorer_id: null,
};

const mockNotifyFollowersOfMatchStart = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/followService', () => ({
  notifyFollowersOfMatchStart: (...args: unknown[]) => mockNotifyFollowersOfMatchStart(...args),
}));

jest.mock('../realtime/io', () => ({
  getIo: () => null,
  matchRoom: (matchId: string) => `match:${matchId}`,
}));

jest.mock('../services/notificationService', () => ({
  sendNotificationToMany: jest.fn().mockResolvedValue(undefined),
}));

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
          return [
            {
              player_id: PLAYER_1,
              bfam_id: 'BF1001',
              full_name: null,
              participant_role: 'PLAYER',
              side_label: null,
            },
          ];
        }
        if (sql.includes('FROM match_teams mt')) return [];
        if (sql.includes('SELECT t.stadium_sound_enabled'))
          return [{ stadium_sound_enabled: true }];
        if (sql.includes('SELECT p.user_id FROM match_players mp')) {
          return [{ user_id: PLAYER_1 }];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async () => undefined,
        bulkUpdate: async () => undefined,
      }),
    },
  };
});

import { startIntro } from '../services/matchIntroService';

describe('startIntro notifies followers on the actual first start (backlog B-9)', () => {
  beforeEach(() => {
    introExists = false;
    mockNotifyFollowersOfMatchStart.mockClear();
  });

  it('notifies followers of the confirmed roster on first start', async () => {
    await startIntro(MATCH_ID, ORGANIZER_USER);

    expect(mockNotifyFollowersOfMatchStart).toHaveBeenCalledWith(MATCH_ID, 'Sunday Cricket', [
      PLAYER_1,
    ]);
  });

  it('does not notify again on a resumed re-entry', async () => {
    introExists = true; // simulates re-entering an already-started intro
    await startIntro(MATCH_ID, ORGANIZER_USER);

    expect(mockNotifyFollowersOfMatchStart).not.toHaveBeenCalled();
  });
});
