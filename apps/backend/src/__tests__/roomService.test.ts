// Unit tests for backlog B-11's roomService. Only `sequelize` (for the
// rooms/room_players tables directly owned by this service) and the
// downstream services convertRoomToMatch orchestrates (bookingService,
// matchService, matchIntroService — each already covered by their own
// tests) are faked, so these tests focus on roomService's own logic:
// captain/membership rules, the editable-split behavior, and the
// guards convertRoomToMatch enforces before handing off.

interface RoomRow {
  room_id: string;
  room_name: string;
  captain_user_id: string;
  ball_type: string;
  overs_per_innings: number;
  max_players: number;
  room_status: 'FILLING' | 'READY' | 'CONVERTED' | 'CANCELLED';
  match_id: string | null;
  created_at: Date;
  updated_at: Date;
}
interface RoomPlayerRow {
  room_player_id: string;
  room_id: string;
  player_id: string;
  side: 'UNASSIGNED' | 'TEAM_A' | 'TEAM_B';
  is_captain: boolean;
  joined_at: Date;
}

const CAPTAIN_USER = 'aaaaaaaa-0000-4000-8000-000000002001';
const CAPTAIN_PLAYER = 'bbbbbbbb-0000-4000-8000-000000002002';
const MEMBER_USER = 'cccccccc-0000-4000-8000-000000002003';
const MEMBER_PLAYER = 'dddddddd-0000-4000-8000-000000002004';
const OUTSIDER_USER = 'eeeeeeee-0000-4000-8000-000000002005';
const OUTSIDER_PLAYER = 'ffffffff-0000-4000-8000-000000002006';
const ROOM_ID = 'a1a1a1a1-0000-4000-8000-000000002007';

const usersByPlayer: Record<string, string> = {
  [CAPTAIN_PLAYER]: CAPTAIN_USER,
  [MEMBER_PLAYER]: MEMBER_USER,
  [OUTSIDER_PLAYER]: OUTSIDER_USER,
};
const playersByUser: Record<string, string> = {
  [CAPTAIN_USER]: CAPTAIN_PLAYER,
  [MEMBER_USER]: MEMBER_PLAYER,
  [OUTSIDER_USER]: OUTSIDER_PLAYER,
};

let rooms: RoomRow[];
let roomPlayers: RoomPlayerRow[];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM players WHERE user_id')) {
          const playerId = playersByUser[r.userId as string];
          return playerId ? [{ player_id: playerId }] : [];
        }
        if (sql.includes('SELECT user_id FROM players WHERE player_id')) {
          const userId = usersByPlayer[r.playerId as string];
          return userId ? [{ user_id: userId }] : [];
        }
        if (sql.includes('FROM rooms WHERE room_id')) {
          const room = rooms.find((x) => x.room_id === r.roomId);
          return room ? [room] : [];
        }
        if (sql.includes('FROM room_players rp')) {
          return roomPlayers
            .filter((p) => p.room_id === r.roomId)
            .map((p) => ({ ...p, bfam_id: `BF${p.player_id.slice(0, 4)}`, full_name: null }));
        }
        if (sql.includes("room_status = 'FILLING'")) {
          return rooms
            .filter((x) => x.room_status === 'FILLING')
            .map((x) => ({
              ...x,
              player_count: roomPlayers.filter((p) => p.room_id === x.room_id).length,
            }));
        }
        if (sql.includes('FROM match_teams WHERE match_id')) {
          return [
            { match_team_id: 'team-a-id', side_label: 'TEAM_A' },
            { match_team_id: 'team-b-id', side_label: 'TEAM_B' },
          ];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, insertRows: Record<string, unknown>[]) => {
          if (table === 'rooms') rooms.push(...(insertRows as unknown as RoomRow[]));
          if (table === 'room_players')
            roomPlayers.push(...(insertRows as unknown as RoomPlayerRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'rooms') {
            const room = rooms.find((x) => x.room_id === where.room_id);
            if (room) Object.assign(room, values);
          }
          if (table === 'room_players') {
            for (const p of roomPlayers) {
              if (p.room_id === where.room_id && p.player_id === where.player_id) {
                Object.assign(p, values);
              }
            }
          }
        },
        bulkDelete: async (table: string, where: Record<string, unknown>) => {
          if (table === 'room_players') {
            roomPlayers = roomPlayers.filter(
              (p) => !(p.room_id === where.room_id && p.player_id === where.player_id),
            );
          }
        },
      }),
    },
  };
});

jest.mock('../services/bookingService', () => ({
  createBooking: jest.fn().mockResolvedValue({ booking_id: 'booking-1', booking_amount: 1000 }),
}));
jest.mock('../services/matchService', () => ({
  createMatch: jest.fn().mockResolvedValue({ match_id: 'match-1' }),
  inviteToMatch: jest.fn().mockResolvedValue({ invitation_id: 'invite-1' }),
  respondToMatchInvitation: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/matchIntroService', () => ({
  assignPlayerSides: jest.fn().mockResolvedValue(undefined),
}));

import {
  assignRoomSides,
  convertRoomToMatch,
  createRoom,
  joinRoom,
  leaveRoom,
  listOpenRooms,
  randomSplitRoom,
} from '../services/roomService';
import {
  AlreadyInRoomError,
  ForbiddenActionError,
  InvalidRoomStateError,
  RoomFullError,
} from '../domain/errors';
import { assignPlayerSides } from '../services/matchIntroService';
import { createBooking } from '../services/bookingService';
import { createMatch, inviteToMatch, respondToMatchInvitation } from '../services/matchService';

function freshRoom(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    room_id: ROOM_ID,
    room_name: 'Friday Night Lights',
    captain_user_id: CAPTAIN_USER,
    ball_type: 'TENNIS',
    overs_per_innings: 6,
    max_players: 4,
    room_status: 'FILLING',
    match_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('roomService (backlog B-11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createBooking as jest.Mock).mockResolvedValue({
      booking_id: 'booking-1',
      booking_amount: 1000,
    });
    (createMatch as jest.Mock).mockResolvedValue({ match_id: 'match-1' });
    (inviteToMatch as jest.Mock).mockResolvedValue({ invitation_id: 'invite-1' });
    (respondToMatchInvitation as jest.Mock).mockResolvedValue(undefined);
    (assignPlayerSides as jest.Mock).mockResolvedValue(undefined);
    rooms = [freshRoom()];
    roomPlayers = [
      {
        room_player_id: 'rp-1',
        room_id: ROOM_ID,
        player_id: CAPTAIN_PLAYER,
        side: 'UNASSIGNED',
        is_captain: true,
        joined_at: new Date(),
      },
    ];
  });

  it('createRoom opens a room and seats the creator as captain', async () => {
    rooms = [];
    roomPlayers = [];
    const result = await createRoom(CAPTAIN_USER, {
      room_name: 'New Room',
      ball_type: 'TENNIS',
      overs_per_innings: 6,
      max_players: 6,
    });

    expect(result.room_name).toBe('New Room');
    expect(result.players).toHaveLength(1);
    expect(result.players[0].is_captain).toBe(true);
  });

  it('listOpenRooms only returns rooms still FILLING', async () => {
    rooms.push(freshRoom({ room_id: 'other-room', room_status: 'CONVERTED' }));
    const results = await listOpenRooms();
    expect(results).toHaveLength(1);
    expect(results[0].room_id).toBe(ROOM_ID);
  });

  it('joinRoom adds a new player to a room that is still filling', async () => {
    const result = await joinRoom(ROOM_ID, MEMBER_USER);
    expect(result.players.map((p) => p.player_id)).toContain(MEMBER_PLAYER);
  });

  it('joinRoom rejects a player who already joined', async () => {
    await joinRoom(ROOM_ID, MEMBER_USER);
    await expect(joinRoom(ROOM_ID, MEMBER_USER)).rejects.toBeInstanceOf(AlreadyInRoomError);
  });

  it('joinRoom rejects once the room is full', async () => {
    rooms[0].max_players = 1;
    await expect(joinRoom(ROOM_ID, MEMBER_USER)).rejects.toBeInstanceOf(RoomFullError);
  });

  it('joinRoom rejects once the room is no longer FILLING', async () => {
    rooms[0].room_status = 'CONVERTED';
    await expect(joinRoom(ROOM_ID, MEMBER_USER)).rejects.toBeInstanceOf(InvalidRoomStateError);
  });

  it('leaveRoom removes a non-captain member without touching the room itself', async () => {
    await joinRoom(ROOM_ID, MEMBER_USER);
    await leaveRoom(ROOM_ID, MEMBER_USER);
    expect(roomPlayers.some((p) => p.player_id === MEMBER_PLAYER)).toBe(false);
    expect(rooms[0].room_status).toBe('FILLING');
  });

  it('leaveRoom cancels the whole room when the captain leaves (disposable, no transfer)', async () => {
    await leaveRoom(ROOM_ID, CAPTAIN_USER);
    expect(rooms[0].room_status).toBe('CANCELLED');
  });

  it('assignRoomSides is captain-only', async () => {
    await joinRoom(ROOM_ID, MEMBER_USER);
    await expect(
      assignRoomSides(ROOM_ID, MEMBER_USER, [{ player_id: MEMBER_PLAYER, side: 'TEAM_A' }]),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });

  it('assignRoomSides lets the captain assign and re-assign sides freely (editable split)', async () => {
    await joinRoom(ROOM_ID, MEMBER_USER);
    await assignRoomSides(ROOM_ID, CAPTAIN_USER, [{ player_id: MEMBER_PLAYER, side: 'TEAM_A' }]);
    expect(roomPlayers.find((p) => p.player_id === MEMBER_PLAYER)?.side).toBe('TEAM_A');

    await assignRoomSides(ROOM_ID, CAPTAIN_USER, [{ player_id: MEMBER_PLAYER, side: 'TEAM_B' }]);
    expect(roomPlayers.find((p) => p.player_id === MEMBER_PLAYER)?.side).toBe('TEAM_B');
  });

  it('randomSplitRoom assigns every player to exactly one side', async () => {
    await joinRoom(ROOM_ID, MEMBER_USER);
    await joinRoom(ROOM_ID, OUTSIDER_USER);
    const result = await randomSplitRoom(ROOM_ID, CAPTAIN_USER);
    expect(result.players.every((p) => p.side === 'TEAM_A' || p.side === 'TEAM_B')).toBe(true);
  });

  it('convertRoomToMatch refuses to start with fewer than 2 players', async () => {
    await expect(
      convertRoomToMatch(ROOM_ID, CAPTAIN_USER, {
        turfId: 'turf-1',
        bookingDate: '2026-10-01',
        startTime: '18:00',
        durationMinutes: 60,
        paymentMode: 'CASH' as never,
      }),
    ).rejects.toBeInstanceOf(InvalidRoomStateError);
  });

  it('convertRoomToMatch refuses to start while any player is still UNASSIGNED', async () => {
    await joinRoom(ROOM_ID, MEMBER_USER);
    // Captain themselves stays UNASSIGNED here — should still block.
    await expect(
      convertRoomToMatch(ROOM_ID, CAPTAIN_USER, {
        turfId: 'turf-1',
        bookingDate: '2026-10-01',
        startTime: '18:00',
        durationMinutes: 60,
        paymentMode: 'CASH' as never,
      }),
    ).rejects.toThrow(/every player must be assigned/i);
  });

  it('convertRoomToMatch books, creates the match, and maps each room side onto the real match_team_id', async () => {
    await joinRoom(ROOM_ID, MEMBER_USER);
    await assignRoomSides(ROOM_ID, CAPTAIN_USER, [
      { player_id: CAPTAIN_PLAYER, side: 'TEAM_A' },
      { player_id: MEMBER_PLAYER, side: 'TEAM_B' },
    ]);

    const result = await convertRoomToMatch(ROOM_ID, CAPTAIN_USER, {
      turfId: 'turf-1',
      bookingDate: '2026-10-01',
      startTime: '18:00',
      durationMinutes: 60,
      paymentMode: 'CASH' as never,
    });

    expect(result.match_id).toBe('match-1');
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ turfId: 'turf-1', bookedBy: CAPTAIN_USER }),
    );
    expect(assignPlayerSides).toHaveBeenCalledWith(
      'match-1',
      CAPTAIN_USER,
      expect.arrayContaining([
        { player_id: CAPTAIN_PLAYER, match_team_id: 'team-a-id' },
        { player_id: MEMBER_PLAYER, match_team_id: 'team-b-id' },
      ]),
    );
    expect(rooms[0].room_status).toBe('CONVERTED');
    expect(rooms[0].match_id).toBe('match-1');
  });

  it('convertRoomToMatch is captain-only', async () => {
    await joinRoom(ROOM_ID, MEMBER_USER);
    await assignRoomSides(ROOM_ID, CAPTAIN_USER, [
      { player_id: CAPTAIN_PLAYER, side: 'TEAM_A' },
      { player_id: MEMBER_PLAYER, side: 'TEAM_B' },
    ]);

    await expect(
      convertRoomToMatch(ROOM_ID, MEMBER_USER, {
        turfId: 'turf-1',
        bookingDate: '2026-10-01',
        startTime: '18:00',
        durationMinutes: 60,
        paymentMode: 'CASH' as never,
      }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
