import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { getIo, matchRoom } from '../realtime/io';
import { sendNotificationToMany } from './notificationService';
import { ForbiddenActionError, MatchNotFoundError } from '../domain/errors';

// Match Chat (backlog B-3): one room per match — persisted messages,
// delivered in real time over the existing Socket.IO layer, with SYSTEM
// rows auto-posted alongside player TEXT messages (see the call sites in
// matchService/paymentService that call postSystemMessage). MVP scope: a
// per-match room, not a separate standing per-team room.

interface MatchRow {
  match_id: string;
  match_name: string | null;
  organizer_id: string;
  assigned_scorer_id: string | null;
}

export interface ChatMessageRow {
  message_id: string;
  match_id: string;
  sender_id: string | null;
  message_type: 'TEXT' | 'SYSTEM';
  body: string;
  created_at: Date;
  sender_bfam_id: string | null;
  sender_full_name: string | null;
}

async function fetchMatch(matchId: string): Promise<MatchRow | null> {
  const [row] = await sequelize.query<MatchRow>(
    'SELECT match_id, match_name, organizer_id, assigned_scorer_id FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return row ?? null;
}

// Who can read/post in a match's chat room: the organizer, the assigned
// scorer, or a confirmed roster player — the same population the Game
// Room (module 2.10) roster shows, not the full invite list.
async function assertCanAccessChat(match: MatchRow, actorUserId: string) {
  if (match.organizer_id === actorUserId || match.assigned_scorer_id === actorUserId) return;
  const [confirmed] = await sequelize.query<{ player_id: string }>(
    `SELECT mp.player_id FROM match_players mp
     JOIN players p ON p.player_id = mp.player_id
     WHERE mp.match_id = :matchId AND mp.invitation_status = 'CONFIRMED' AND p.user_id = :userId`,
    { type: QueryTypes.SELECT, replacements: { matchId: match.match_id, userId: actorUserId } },
  );
  if (!confirmed) {
    throw new ForbiddenActionError('Only a confirmed roster player can access this match chat.');
  }
}

async function confirmedRosterUserIds(matchId: string, excludeUserId?: string): Promise<string[]> {
  const rows = await sequelize.query<{ user_id: string }>(
    `SELECT p.user_id FROM match_players mp
     JOIN players p ON p.player_id = mp.player_id
     WHERE mp.match_id = :matchId AND mp.invitation_status = 'CONFIRMED'`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return rows.map((r) => r.user_id).filter((id) => id !== excludeUserId);
}

function broadcastMessage(matchId: string, message: ChatMessageRow) {
  getIo()?.to(matchRoom(matchId)).emit('match:chat_message', { matchId, message });
}

async function notifyNewMessage(
  matchId: string,
  matchName: string | null,
  preview: string,
  excludeUserId?: string,
) {
  const [organizerRow] = await sequelize.query<{
    organizer_id: string;
    assigned_scorer_id: string | null;
  }>('SELECT organizer_id, assigned_scorer_id FROM matches WHERE match_id = :matchId', {
    type: QueryTypes.SELECT,
    replacements: { matchId },
  });
  const recipients = new Set(await confirmedRosterUserIds(matchId, excludeUserId));
  if (organizerRow) {
    if (organizerRow.organizer_id !== excludeUserId) recipients.add(organizerRow.organizer_id);
    if (organizerRow.assigned_scorer_id && organizerRow.assigned_scorer_id !== excludeUserId) {
      recipients.add(organizerRow.assigned_scorer_id);
    }
  }
  if (recipients.size === 0) return;
  await sendNotificationToMany(
    Array.from(recipients),
    'NEW_MESSAGE',
    { matchName: matchName ?? 'your match', preview },
    'match',
    matchId,
  );
}

export async function getMessages(matchId: string, actorUserId: string): Promise<ChatMessageRow[]> {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanAccessChat(match, actorUserId);

  return sequelize.query<ChatMessageRow>(
    `SELECT m.message_id, m.match_id, m.sender_id, m.message_type, m.body, m.created_at,
            p.bfam_id AS sender_bfam_id, p.full_name AS sender_full_name
     FROM match_messages m
     LEFT JOIN players p ON p.user_id = m.sender_id
     WHERE m.match_id = :matchId
     ORDER BY m.created_at ASC`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
}

export async function sendMessage(
  matchId: string,
  actorUserId: string,
  body: string,
): Promise<ChatMessageRow> {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanAccessChat(match, actorUserId);

  const messageId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('match_messages', [
    {
      message_id: messageId,
      match_id: matchId,
      sender_id: actorUserId,
      message_type: 'TEXT',
      body,
      created_at: now,
    },
  ]);

  const [sender] = await sequelize.query<{ bfam_id: string | null; full_name: string | null }>(
    'SELECT bfam_id, full_name FROM players WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId: actorUserId } },
  );
  const message: ChatMessageRow = {
    message_id: messageId,
    match_id: matchId,
    sender_id: actorUserId,
    message_type: 'TEXT',
    body,
    created_at: now,
    sender_bfam_id: sender?.bfam_id ?? null,
    sender_full_name: sender?.full_name ?? null,
  };

  broadcastMessage(matchId, message);

  const senderLabel = message.sender_full_name || message.sender_bfam_id || 'Someone';
  await notifyNewMessage(matchId, match.match_name, `${senderLabel}: ${body}`, actorUserId).catch(
    (error) => console.error(`[chatService] Failed to notify new message for ${matchId}:`, error),
  );

  return message;
}

// Auto-posted system messages (backlog B-3: "updates like player check-in
// and payment get automatically pushed into the team room/chat with
// notifications") — called from matchService (check-in, confirmation) and
// paymentService (payment collected/fully paid) at their existing state-
// transition points, never blocking the action that triggered it.
export async function postSystemMessage(matchId: string, body: string): Promise<void> {
  try {
    const match = await fetchMatch(matchId);
    if (!match) return;

    const messageId = randomUUID();
    const now = new Date();
    await sequelize.getQueryInterface().bulkInsert('match_messages', [
      {
        message_id: messageId,
        match_id: matchId,
        sender_id: null,
        message_type: 'SYSTEM',
        body,
        created_at: now,
      },
    ]);

    const message: ChatMessageRow = {
      message_id: messageId,
      match_id: matchId,
      sender_id: null,
      message_type: 'SYSTEM',
      body,
      created_at: now,
      sender_bfam_id: null,
      sender_full_name: null,
    };
    broadcastMessage(matchId, message);
    await notifyNewMessage(matchId, match.match_name, body);
  } catch (error) {
    console.error(`[chatService] Failed to post system message for ${matchId}:`, error);
  }
}
