import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  AlreadyInRoomError,
  ForbiddenActionError,
  InvalidRoomStateError,
  PlayerProfileNotFoundError,
  RoomFullError,
  RoomNotFoundError,
} from '../domain/errors';
import { createBooking, type CreateBookingInput } from './bookingService';
import { createMatch, inviteToMatch, respondToMatchInvitation } from './matchService';
import { assignPlayerSides } from './matchIntroService';

// Backlog B-11: a pre-match "room" — an online-lobby-style flow alongside
// today's book-first match creation, not a replacement for it. See the
// migration (20260912100000-match-rooms.ts) for the full design rationale
// and the product decisions this was built against (editable side-split,
// never linked to the persistent teams entity).

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
  bfam_id?: string;
  full_name?: string | null;
}

async function resolvePlayerId(userId: string): Promise<string> {
  const [player] = await sequelize.query<{ player_id: string }>(
    'SELECT player_id FROM players WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  if (!player) throw new PlayerProfileNotFoundError();
  return player.player_id;
}

async function fetchRoom(roomId: string): Promise<RoomRow | null> {
  const [room] = await sequelize.query<RoomRow>('SELECT * FROM rooms WHERE room_id = :roomId', {
    type: QueryTypes.SELECT,
    replacements: { roomId },
  });
  return room ?? null;
}

async function fetchRoomOrThrow(roomId: string): Promise<RoomRow> {
  const room = await fetchRoom(roomId);
  if (!room) throw new RoomNotFoundError(roomId);
  return room;
}

async function fetchRoomPlayers(roomId: string): Promise<RoomPlayerRow[]> {
  const rows = await sequelize.query<RoomPlayerRow>(
    `SELECT rp.*, p.bfam_id, p.full_name FROM room_players rp
     JOIN players p ON p.player_id = rp.player_id
     WHERE rp.room_id = :roomId
     ORDER BY rp.is_captain DESC, rp.joined_at ASC`,
    { type: QueryTypes.SELECT, replacements: { roomId } },
  );
  // MySQL returns TINYINT(1) as a raw 0/1 number, not a real boolean — coerce
  // here so callers (and the mobile client's `{p.is_captain && <Badge/>}`
  // JSX) get an actual boolean rather than a falsy 0 that React would
  // render as literal text.
  return rows.map((r) => ({ ...r, is_captain: Boolean(r.is_captain) }));
}

function assertIsCaptain(room: RoomRow, userId: string) {
  if (room.captain_user_id !== userId) {
    throw new ForbiddenActionError("Only this room's captain can do that.");
  }
}

export interface CreateRoomInput {
  room_name: string;
  ball_type: string;
  overs_per_innings: number;
  max_players: number;
}

// Opens a room and adds its creator as the first (captain) player —
// mirrors createTeam's "creator is captain atomically" shape.
export async function createRoom(userId: string, input: CreateRoomInput) {
  const playerId = await resolvePlayerId(userId);
  const roomId = randomUUID();
  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    await sequelize.getQueryInterface().bulkInsert(
      'rooms',
      [
        {
          room_id: roomId,
          room_name: input.room_name,
          captain_user_id: userId,
          ball_type: input.ball_type,
          overs_per_innings: input.overs_per_innings,
          max_players: input.max_players,
          room_status: 'FILLING',
          match_id: null,
          created_at: now,
          updated_at: now,
        },
      ],
      { transaction },
    );
    await sequelize.getQueryInterface().bulkInsert(
      'room_players',
      [
        {
          room_player_id: randomUUID(),
          room_id: roomId,
          player_id: playerId,
          side: 'UNASSIGNED',
          is_captain: true,
          joined_at: now,
        },
      ],
      { transaction },
    );
  });

  return getRoomDetails(roomId);
}

// Discovery surface for a room, parallel to Open Teams (backlog docs'
// proposed shape) — only rooms still filling, with a player count so the
// list doesn't need a second round-trip per room.
export async function listOpenRooms() {
  return sequelize.query<RoomRow & { player_count: number }>(
    `SELECT r.*, COUNT(rp.room_player_id) AS player_count
     FROM rooms r
     LEFT JOIN room_players rp ON rp.room_id = r.room_id
     WHERE r.room_status = 'FILLING'
     GROUP BY r.room_id
     ORDER BY r.created_at DESC`,
    { type: QueryTypes.SELECT },
  );
}

export async function getRoomDetails(roomId: string) {
  const room = await fetchRoomOrThrow(roomId);
  const players = await fetchRoomPlayers(roomId);
  return { ...room, players };
}

export async function joinRoom(roomId: string, userId: string) {
  const room = await fetchRoomOrThrow(roomId);
  if (room.room_status !== 'FILLING') {
    throw new InvalidRoomStateError('This room is no longer accepting players.');
  }
  const playerId = await resolvePlayerId(userId);
  const players = await fetchRoomPlayers(roomId);
  if (players.some((p) => p.player_id === playerId)) throw new AlreadyInRoomError();
  if (players.length >= room.max_players) throw new RoomFullError();

  await sequelize.getQueryInterface().bulkInsert('room_players', [
    {
      room_player_id: randomUUID(),
      room_id: roomId,
      player_id: playerId,
      side: 'UNASSIGNED',
      is_captain: false,
      joined_at: new Date(),
    },
  ]);
  return getRoomDetails(roomId);
}

// A non-captain leaves on their own. The captain leaving cancels the room
// outright instead — a room is a disposable, throwaway lobby (per product
// decision, never saved as a persistent team), so there's no "transfer
// captaincy" ceremony like the real Teams feature has; simplest correct
// behavior is: no captain, no room.
export async function leaveRoom(roomId: string, userId: string) {
  const room = await fetchRoomOrThrow(roomId);
  const playerId = await resolvePlayerId(userId);

  if (room.captain_user_id === userId) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'rooms',
        { room_status: 'CANCELLED', updated_at: new Date() },
        { room_id: roomId },
      );
    return;
  }
  await sequelize
    .getQueryInterface()
    .bulkDelete('room_players', { room_id: roomId, player_id: playerId });
}

// Manual side assignment — captain-only, freely re-callable (editable
// split, per product decision) any time before the room converts.
export async function assignRoomSides(
  roomId: string,
  actorUserId: string,
  assignments: Array<{ player_id: string; side: 'UNASSIGNED' | 'TEAM_A' | 'TEAM_B' }>,
) {
  const room = await fetchRoomOrThrow(roomId);
  assertIsCaptain(room, actorUserId);
  if (room.room_status === 'CONVERTED' || room.room_status === 'CANCELLED') {
    throw new InvalidRoomStateError('This room has already been converted or cancelled.');
  }

  const players = await fetchRoomPlayers(roomId);
  const validPlayerIds = new Set(players.map((p) => p.player_id));
  for (const a of assignments) {
    if (!validPlayerIds.has(a.player_id)) {
      throw new InvalidRoomStateError('One of the selected players is not in this room.');
    }
  }

  await sequelize.transaction(async (transaction) => {
    for (const a of assignments) {
      await sequelize
        .getQueryInterface()
        .bulkUpdate(
          'room_players',
          { side: a.side },
          { room_id: roomId, player_id: a.player_id },
          { transaction },
        );
    }
  });
  return getRoomDetails(roomId);
}

// Random shuffle into two roughly-even sides — re-callable any number of
// times (each call re-shuffles everyone), and the captain can still hand-
// edit the result afterward via assignRoomSides before converting.
export async function randomSplitRoom(roomId: string, actorUserId: string) {
  const room = await fetchRoomOrThrow(roomId);
  assertIsCaptain(room, actorUserId);
  if (room.room_status === 'CONVERTED' || room.room_status === 'CANCELLED') {
    throw new InvalidRoomStateError('This room has already been converted or cancelled.');
  }

  const players = await fetchRoomPlayers(roomId);
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const half = Math.ceil(shuffled.length / 2);

  await sequelize.transaction(async (transaction) => {
    for (const [index, p] of shuffled.entries()) {
      const side = index < half ? 'TEAM_A' : 'TEAM_B';
      await sequelize.getQueryInterface().bulkUpdate(
        'room_players',
        { side },
        { room_id: roomId, player_id: p.player_id },
        {
          transaction,
        },
      );
    }
  });
  return getRoomDetails(roomId);
}

export interface ConvertRoomInput {
  turfId: string;
  bookingDate: string;
  startTime: string;
  durationMinutes: number;
  paymentMode: CreateBookingInput['paymentMode'];
}

// Books a turf and converts the room into a real match — from here on,
// hands off to the already-built Match Intro sequence (countdown →
// Playing XI reveal → toss) completely unchanged; the only thing this
// does differently from today's book-first flow is skip the one-by-one
// invite step (every room player already opted in, so they're invited and
// auto-confirmed in one pass) and pre-populate match_players.match_team_id
// from the room's side-split — closing backlog A-10's "batter/bowler
// selectable from either side" gap for this flow specifically. Requires
// every room player to have a side assigned first (no half-split matches).
export async function convertRoomToMatch(
  roomId: string,
  actorUserId: string,
  input: ConvertRoomInput,
) {
  const room = await fetchRoomOrThrow(roomId);
  assertIsCaptain(room, actorUserId);
  if (room.room_status !== 'FILLING' && room.room_status !== 'READY') {
    throw new InvalidRoomStateError('This room has already been converted or cancelled.');
  }

  const players = await fetchRoomPlayers(roomId);
  if (players.length < 2) {
    throw new InvalidRoomStateError('A room needs at least 2 players before it can start a match.');
  }
  if (players.some((p) => p.side === 'UNASSIGNED')) {
    throw new InvalidRoomStateError('Every player must be assigned a side before starting.');
  }

  const booking = await createBooking({
    turfId: input.turfId,
    bookedBy: actorUserId,
    bookingDate: input.bookingDate,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    paymentMode: input.paymentMode,
  });
  await sequelize
    .getQueryInterface()
    .bulkUpdate('bookings', { booking_status: 'CONFIRMED' }, { booking_id: booking.booking_id });

  const match = await createMatch(actorUserId, {
    booking_id: booking.booking_id,
    match_name: room.room_name,
    match_type: 'FRIENDS',
    ball_type: room.ball_type,
    overs_per_innings: room.overs_per_innings,
    scoring_mode: 'PLAYER_MANAGED',
  });

  const nonCaptainPlayers = players.filter((p) => !p.is_captain);
  for (const p of nonCaptainPlayers) {
    const invite = await inviteToMatch(match.match_id, actorUserId, p.player_id);
    const [playerUser] = await sequelize.query<{ user_id: string }>(
      'SELECT user_id FROM players WHERE player_id = :playerId',
      { type: QueryTypes.SELECT, replacements: { playerId: p.player_id } },
    );
    if (playerUser) {
      await respondToMatchInvitation(invite.invitation_id, playerUser.user_id, 'CONFIRMED');
    }
  }

  const matchTeams = await sequelize.query<{ match_team_id: string; side_label: string }>(
    'SELECT match_team_id, side_label FROM match_teams WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId: match.match_id } },
  );
  const teamAId = matchTeams.find((t) => t.side_label === 'TEAM_A')!.match_team_id;
  const teamBId = matchTeams.find((t) => t.side_label === 'TEAM_B')!.match_team_id;

  await assignPlayerSides(
    match.match_id,
    actorUserId,
    players.map((p) => ({
      player_id: p.player_id,
      match_team_id: p.side === 'TEAM_A' ? teamAId : teamBId,
    })),
  );

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'rooms',
      { room_status: 'CONVERTED', match_id: match.match_id, updated_at: new Date() },
      { room_id: roomId },
    );

  return { room_id: roomId, match_id: match.match_id, booking_id: booking.booking_id };
}
