// Integration tests for backlog B-3's chat service: one room per match,
// access restricted to the organizer/scorer/confirmed roster, persisted
// messages, and a broadcast + notification on every send. Only
// `sequelize` and the realtime `io` reference are faked.

interface MatchRow {
  match_id: string;
  match_name: string | null;
  organizer_id: string;
  assigned_scorer_id: string | null;
}
interface MatchPlayerRow {
  match_id: string;
  player_id: string;
  invitation_status: string;
}
interface PlayerRow {
  player_id: string;
  user_id: string;
  bfam_id: string;
  full_name: string | null;
}

const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000000901';
const ORGANIZER_USER = 'bbbbbbbb-0000-4000-8000-000000000902';
const OUTSIDER_USER = 'cccccccc-0000-4000-8000-000000000903';
const PLAYER_1_USER = 'dddddddd-0000-4000-8000-000000000904';
const PLAYER_1_ID = 'eeeeeeee-0000-4000-8000-000000000905';

let match: MatchRow | null;
let matchPlayers: MatchPlayerRow[];
let players: PlayerRow[];
const messages: Record<string, unknown>[] = [];
const emitted: { event: string; payload: unknown }[] = [];

jest.mock('../realtime/io', () => ({
  getIo: () => ({
    to: () => ({
      emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
    }),
  }),
  matchRoom: (matchId: string) => `match:${matchId}`,
}));

const mockSendNotificationToMany = jest.fn();
jest.mock('../services/notificationService', () => ({
  sendNotificationToMany: (...args: unknown[]) => mockSendNotificationToMany(...args),
}));

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (
          sql.includes('SELECT match_id, match_name, organizer_id, assigned_scorer_id FROM matches')
        ) {
          return match && match.match_id === r.matchId ? [match] : [];
        }
        if (sql.includes('SELECT organizer_id, assigned_scorer_id FROM matches')) {
          return match && match.match_id === r.matchId
            ? [{ organizer_id: match.organizer_id, assigned_scorer_id: match.assigned_scorer_id }]
            : [];
        }
        if (
          sql.includes('mp.player_id FROM match_players mp') &&
          sql.includes('p.user_id = :userId')
        ) {
          const found = matchPlayers.find(
            (mp) =>
              mp.match_id === r.matchId &&
              mp.invitation_status === 'CONFIRMED' &&
              players.find((p) => p.player_id === mp.player_id)?.user_id === r.userId,
          );
          return found ? [{ player_id: found.player_id }] : [];
        }
        if (sql.includes('p.user_id FROM match_players mp')) {
          return matchPlayers
            .filter((mp) => mp.match_id === r.matchId && mp.invitation_status === 'CONFIRMED')
            .map((mp) => ({ user_id: players.find((p) => p.player_id === mp.player_id)?.user_id }));
        }
        if (sql.includes('SELECT bfam_id, full_name FROM players WHERE user_id')) {
          const p = players.find((x) => x.user_id === r.userId);
          return p ? [{ bfam_id: p.bfam_id, full_name: p.full_name }] : [];
        }
        if (sql.includes('FROM match_messages m')) {
          return messages.filter((m) => m.match_id === r.matchId);
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'match_messages') messages.push(...rows);
        },
      }),
    },
  };
});

import { getMessages, postSystemMessage, sendMessage } from '../services/chatService';

describe('Match Chat (backlog B-3)', () => {
  beforeEach(() => {
    match = {
      match_id: MATCH_ID,
      match_name: 'Sunday Cricket',
      organizer_id: ORGANIZER_USER,
      assigned_scorer_id: null,
    };
    players = [
      {
        player_id: PLAYER_1_ID,
        user_id: PLAYER_1_USER,
        bfam_id: 'BF1001',
        full_name: 'Asha Patel',
      },
    ];
    matchPlayers = [{ match_id: MATCH_ID, player_id: PLAYER_1_ID, invitation_status: 'CONFIRMED' }];
    messages.length = 0;
    emitted.length = 0;
    mockSendNotificationToMany.mockReset().mockResolvedValue(undefined);
  });

  it('lets a confirmed roster player send a message, persisted and broadcast', async () => {
    const message = await sendMessage(MATCH_ID, PLAYER_1_USER, 'On my way!');

    expect(message.body).toBe('On my way!');
    expect(message.message_type).toBe('TEXT');
    expect(messages).toHaveLength(1);
    expect(emitted).toEqual([
      { event: 'match:chat_message', payload: expect.objectContaining({ matchId: MATCH_ID }) },
    ]);
  });

  it('notifies the rest of the roster (not the sender) on a new message', async () => {
    matchPlayers.push({
      match_id: MATCH_ID,
      player_id: 'other-player',
      invitation_status: 'CONFIRMED',
    });
    players.push({
      player_id: 'other-player',
      user_id: 'other-user',
      bfam_id: 'BF1002',
      full_name: null,
    });

    await sendMessage(MATCH_ID, PLAYER_1_USER, 'Hello');

    expect(mockSendNotificationToMany).toHaveBeenCalledWith(
      expect.arrayContaining([ORGANIZER_USER, 'other-user']),
      'NEW_MESSAGE',
      expect.objectContaining({ matchName: 'Sunday Cricket' }),
      'match',
      MATCH_ID,
    );
    const [recipients] = mockSendNotificationToMany.mock.calls[0];
    expect(recipients).not.toContain(PLAYER_1_USER);
  });

  it('lets the organizer send a message even though they are not on match_players', async () => {
    const message = await sendMessage(MATCH_ID, ORGANIZER_USER, 'Reminder: bring your own bat.');
    expect(message.sender_id).toBe(ORGANIZER_USER);
  });

  it('rejects a non-participant from sending a message', async () => {
    await expect(sendMessage(MATCH_ID, OUTSIDER_USER, 'Can I join?')).rejects.toThrow(
      /confirmed roster player/i,
    );
  });

  it('rejects a non-participant from reading the chat history', async () => {
    await expect(getMessages(MATCH_ID, OUTSIDER_USER)).rejects.toThrow(/confirmed roster player/i);
  });

  it('returns full message history, oldest first, for a participant', async () => {
    await sendMessage(MATCH_ID, PLAYER_1_USER, 'First message');
    await sendMessage(MATCH_ID, ORGANIZER_USER, 'Second message');

    const history = await getMessages(MATCH_ID, PLAYER_1_USER);
    expect(history.map((m) => m.body)).toEqual(['First message', 'Second message']);
  });

  it('postSystemMessage persists a SYSTEM message with no sender and never throws', async () => {
    await postSystemMessage(MATCH_ID, 'Asha Patel checked in.');

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ message_type: 'SYSTEM', sender_id: null });
  });

  it('postSystemMessage swallows errors instead of throwing (never blocks the triggering action)', async () => {
    match = null; // fetchMatch returns null -> early return, no throw
    await expect(postSystemMessage(MATCH_ID, 'irrelevant')).resolves.toBeUndefined();
  });
});
