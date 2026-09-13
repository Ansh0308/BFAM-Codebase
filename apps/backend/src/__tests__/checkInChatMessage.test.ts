// Integration test for backlog B-3's auto-posted system message on
// self check-in: updateMyAttendance('CHECKED_IN') should post
// "<name> checked in." into the match's chat room, without ever failing
// the check-in itself if the message post has a problem. Only
// `sequelize` and `realtime/io` are faked.

const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000001101';
const USER_ID = 'bbbbbbbb-0000-4000-8000-000000001102';
const PLAYER_ID = 'cccccccc-0000-4000-8000-000000001103';

const matchPlayer = {
  match_player_id: 'mp-1',
  match_id: MATCH_ID,
  player_id: PLAYER_ID,
  attendance_status: 'PENDING',
};
const player = { player_id: PLAYER_ID, bfam_id: 'BF1001', full_name: 'Asha Patel' };
const match = {
  match_id: MATCH_ID,
  match_name: 'Sunday Cricket',
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
};

const messages: Record<string, unknown>[] = [];
const emitted: unknown[] = [];

jest.mock('../realtime/io', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emitted.push(args) }) }),
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
        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          return r.userId === USER_ID ? [{ player_id: PLAYER_ID }] : [];
        }
        if (sql.includes('SELECT * FROM match_players WHERE match_id')) {
          return matchPlayer.match_id === r.matchId && matchPlayer.player_id === r.playerId
            ? [matchPlayer]
            : [];
        }
        if (sql.includes('SELECT bfam_id, full_name FROM players WHERE player_id')) {
          return r.playerId === PLAYER_ID ? [player] : [];
        }
        if (
          sql.includes('SELECT match_id, match_name, organizer_id, assigned_scorer_id FROM matches')
        ) {
          return r.matchId === MATCH_ID ? [match] : [];
        }
        if (sql.includes('SELECT organizer_id, assigned_scorer_id FROM matches')) {
          return [
            { organizer_id: match.organizer_id, assigned_scorer_id: match.assigned_scorer_id },
          ];
        }
        if (sql.includes('p.user_id FROM match_players mp')) return [];
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'match_players' && where.match_player_id === matchPlayer.match_player_id) {
            Object.assign(matchPlayer, values);
          }
        },
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'match_messages') messages.push(...rows);
        },
      }),
    },
  };
});

import { updateMyAttendance } from '../services/matchService';

describe('Self check-in posts a chat system message (backlog B-3)', () => {
  beforeEach(() => {
    matchPlayer.attendance_status = 'PENDING';
    messages.length = 0;
    emitted.length = 0;
  });

  it('posts "<name> checked in." to the match chat on CHECKED_IN', async () => {
    await updateMyAttendance(MATCH_ID, USER_ID, 'CHECKED_IN');

    expect(matchPlayer.attendance_status).toBe('CHECKED_IN');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      match_id: MATCH_ID,
      message_type: 'SYSTEM',
      body: 'Asha Patel checked in.',
    });
  });

  it('does not post a message for RUNNING_LATE', async () => {
    await updateMyAttendance(MATCH_ID, USER_ID, 'RUNNING_LATE');

    expect(matchPlayer.attendance_status).toBe('RUNNING_LATE');
    expect(messages).toHaveLength(0);
  });
});
