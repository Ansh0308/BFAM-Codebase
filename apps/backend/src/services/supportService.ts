import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { isValidStatusTransition, type SupportStatus } from '../domain/supportTicket';
import {
  ForbiddenActionError,
  InvalidTicketStatusTransitionError,
  SupportTicketNotFoundError,
  WaiverNotAcceptedError,
} from '../domain/errors';
import { sendNotification } from './notificationService';

export interface SupportTicketRow {
  ticket_id: string;
  raised_by: string;
  category: string;
  description: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  status: SupportStatus;
  dispute_type: 'COMPLAINT' | 'MATCH_DISPUTE' | 'INJURY_REPORT';
  assigned_to: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

async function fetchTicket(ticketId: string): Promise<SupportTicketRow | null> {
  const [row] = await sequelize.query<SupportTicketRow>(
    'SELECT * FROM support_tickets WHERE ticket_id = :ticketId',
    { type: QueryTypes.SELECT, replacements: { ticketId } },
  );
  return row ?? null;
}

// Help Center / Contact Support / Submit Complaint (module 2.13, PRD
// §12.57) — the general-purpose ticket every category/screen ultimately
// funnels into.
export interface CreateComplaintInput {
  category: 'PAYMENT_ISSUE' | 'BOOKING_ISSUE' | 'MATCH_ISSUE' | 'ACCOUNT_ISSUE' | 'OTHER';
  description: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

export async function createComplaint(userId: string, input: CreateComplaintInput) {
  return insertTicket(userId, {
    category: input.category,
    description: input.description,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    disputeType: 'COMPLAINT',
  });
}

// In-app dispute flow for scoring/result disagreements (module 2.13, PRD
// §32.2) — linked from the Match Result/Scorecard screens (module 2.8).
// Only someone who was actually on the match roster (or its organizer)
// can dispute it — an outsider has no standing to.
export async function createMatchDispute(userId: string, matchId: string, description: string) {
  const [match] = await sequelize.query<{ organizer_id: string }>(
    'SELECT organizer_id FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  if (!match) throw new SupportTicketNotFoundError();

  const isOrganizer = match.organizer_id === userId;
  let isRosterPlayer = false;
  if (!isOrganizer) {
    const [player] = await sequelize.query<{ player_id: string }>(
      'SELECT player_id FROM players WHERE user_id = :userId',
      { type: QueryTypes.SELECT, replacements: { userId } },
    );
    if (player) {
      const [onRoster] = await sequelize.query<{ match_player_id: string }>(
        'SELECT match_player_id FROM match_players WHERE match_id = :matchId AND player_id = :playerId',
        { type: QueryTypes.SELECT, replacements: { matchId, playerId: player.player_id } },
      );
      isRosterPlayer = Boolean(onRoster);
    }
  }
  if (!isOrganizer && !isRosterPlayer) {
    throw new ForbiddenActionError('Only someone who played in this match can dispute its result.');
  }

  return insertTicket(userId, {
    category: 'MATCH_ISSUE',
    description,
    relatedEntityType: 'match',
    relatedEntityId: matchId,
    disputeType: 'MATCH_DISPUTE',
  });
}

// Injury report flow (module 2.13, PRD §32.9) — gated on the liability
// waiver captured during onboarding (see the migration/accountService.ts
// comments for why that gate is meaningful today).
export async function createInjuryReport(
  userId: string,
  description: string,
  matchId?: string | null,
) {
  const [user] = await sequelize.query<{ liability_waiver_accepted_at: Date | null }>(
    'SELECT liability_waiver_accepted_at FROM users WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  if (!user?.liability_waiver_accepted_at) {
    throw new WaiverNotAcceptedError();
  }

  return insertTicket(userId, {
    category: matchId ? 'MATCH_ISSUE' : 'OTHER',
    description,
    relatedEntityType: matchId ? 'match' : null,
    relatedEntityId: matchId ?? null,
    disputeType: 'INJURY_REPORT',
  });
}

async function insertTicket(
  userId: string,
  input: {
    category: string;
    description: string;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    disputeType: 'COMPLAINT' | 'MATCH_DISPUTE' | 'INJURY_REPORT';
  },
) {
  const ticketId = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('support_tickets', [
    {
      ticket_id: ticketId,
      raised_by: userId,
      category: input.category,
      description: input.description,
      related_entity_type: input.relatedEntityType,
      related_entity_id: input.relatedEntityId,
      status: 'OPEN',
      dispute_type: input.disputeType,
      assigned_to: null,
      created_at: new Date(),
      resolved_at: null,
    },
  ]);
  return fetchTicket(ticketId);
}

// Complaint Status (module 2.13, PRD §12.57) — every ticket the caller has
// raised.
export async function listMyTickets(userId: string) {
  return sequelize.query<SupportTicketRow>(
    'SELECT * FROM support_tickets WHERE raised_by = :userId ORDER BY created_at DESC',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
}

export async function getTicket(ticketId: string, userId: string): Promise<SupportTicketRow> {
  const ticket = await fetchTicket(ticketId);
  if (!ticket) throw new SupportTicketNotFoundError();
  if (ticket.raised_by !== userId) {
    throw new ForbiddenActionError('You can only view your own support tickets.');
  }
  return ticket;
}

// Support-staff/admin side: advances a ticket through the state machine
// (module 2.13's "dispute flow state transitions" requirement) — an
// invalid transition (e.g. CLOSED -> OPEN) is rejected before it ever
// reaches the database.
export async function updateTicketStatus(
  ticketId: string,
  actorUserId: string,
  newStatus: SupportStatus,
) {
  const ticket = await fetchTicket(ticketId);
  if (!ticket) throw new SupportTicketNotFoundError();
  if (!isValidStatusTransition(ticket.status, newStatus)) {
    throw new InvalidTicketStatusTransitionError(ticket.status, newStatus);
  }

  const now = new Date();
  await sequelize.getQueryInterface().bulkUpdate(
    'support_tickets',
    {
      status: newStatus,
      assigned_to: actorUserId,
      resolved_at: newStatus === 'RESOLVED' || newStatus === 'CLOSED' ? now : null,
    },
    { ticket_id: ticketId },
  );

  await sendNotification({
    userId: ticket.raised_by,
    event: 'BOOKING_UPDATE',
    params: { message: `Your support ticket is now ${newStatus.replace('_', ' ').toLowerCase()}.` },
    relatedEntityType: 'support_ticket',
    relatedEntityId: ticketId,
  });

  return fetchTicket(ticketId);
}
