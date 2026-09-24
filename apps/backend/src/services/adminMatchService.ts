import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { InvalidMatchStateError, MatchNotFoundError } from '../domain/errors';
import { writeAuditLog } from './auditLogService';

// Backlog E-2 — Match Management in Admin Web (PRD §9.1). Same shape as
// E-3/E-4/E-5: Admin Web has no match visibility at all today, and there
// is no organizer-facing "cancel this match" flow to relax an ownership
// check on (unlike E-3's turf editor) — cancellation only ever happens
// implicitly, nothing calls it directly. What's needed: a directory
// across every organizer's matches, and a force-cancel action for
// moderation (e.g. a disputed or abusive match) — the one thing only an
// admin should be able to do regardless of who organized it.
export interface AdminMatchRow {
  match_id: string;
  match_name: string | null;
  match_type: string;
  match_status: string;
  visibility: string;
  scheduled_start_time: Date;
  organizer_name: string | null;
  organizer_phone: string;
  turf_name: string | null;
  created_at: Date;
}

export async function listAllMatchesForAdmin(): Promise<AdminMatchRow[]> {
  return sequelize.query<AdminMatchRow>(
    `SELECT m.match_id, m.match_name, m.match_type, m.match_status, m.visibility,
            m.scheduled_start_time, p.full_name AS organizer_name, u.phone_number AS organizer_phone,
            t.turf_name, m.created_at
     FROM matches m
     JOIN users u ON u.user_id = m.organizer_id
     LEFT JOIN players p ON p.user_id = m.organizer_id
     LEFT JOIN bookings b ON b.booking_id = m.booking_id
     LEFT JOIN turfs t ON t.turf_id = b.turf_id
     ORDER BY m.created_at DESC`,
    { type: QueryTypes.SELECT },
  );
}

// Force-cancels a match regardless of who organized it — the one action
// only an admin should be able to take (an organizer's own cancel flow,
// if one is ever built, is a separate, narrower thing). A match already
// COMPLETED or CANCELLED can't be force-cancelled — nothing left to stop.
export async function forceCancelMatchAsAdmin(
  matchId: string,
  actorUserId: string,
): Promise<AdminMatchRow> {
  const [match] = await sequelize.query<{ match_status: string }>(
    'SELECT match_status FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  if (!match) throw new MatchNotFoundError(matchId);
  if (match.match_status === 'COMPLETED' || match.match_status === 'CANCELLED') {
    throw new InvalidMatchStateError(
      `Match is already ${match.match_status.toLowerCase()} and cannot be cancelled.`,
    );
  }

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'matches',
      { match_status: 'CANCELLED', updated_at: new Date() },
      { match_id: matchId },
    );

  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'MATCH_FORCE_CANCELLED',
    resourceType: 'match',
    resourceId: matchId,
    beforeData: { match_status: match.match_status },
    afterData: { match_status: 'CANCELLED' },
  });

  const [updated] = await listAllMatchesForAdmin().then((rows) =>
    rows.filter((r) => r.match_id === matchId),
  );
  return updated;
}
