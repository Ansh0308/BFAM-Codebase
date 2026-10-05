import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { ForbiddenActionError } from '../domain/errors';

// Web live scoring (Owner / Staff console): for a match whose scoring mode is
// TURF_STAFF_MANAGED, the turf's own owner and its approved, active staff may
// run the toss and record balls — not only a pre-assigned scorer. Matches that
// players score themselves stay with the organizer / assigned scorer.
//
// Callers only reach for this after their own organizer / scorer check has
// failed, so the extra query costs nothing on the common path.
export async function isTurfOperatorForMatch(matchId: string, userId: string): Promise<boolean> {
  const rows = await sequelize.query<{ match_id: string }>(
    `SELECT m.match_id
     FROM matches m
     JOIN bookings b ON b.booking_id = m.booking_id
     JOIN turfs t ON t.turf_id = b.turf_id
     WHERE m.match_id = :matchId
       AND m.scoring_mode = 'TURF_STAFF_MANAGED'
       AND (
         t.owner_id = :userId
         OR EXISTS (
           SELECT 1 FROM turf_staff_assignments a
           WHERE a.turf_id = t.turf_id AND a.staff_user_id = :userId
             AND a.status = 'ACTIVE' AND a.verification_status = 'APPROVED'
             AND NOT COALESCE(JSON_EXTRACT(a.permissions, '$.score_matches') = CAST('false' AS JSON), 0)
         )
       )
     LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { matchId, userId } },
  );
  return rows.length > 0;
}

// A match created for a tournament fixture belongs to the tournament's host and
// to nobody else: the toss, the setup and every ball are theirs to run. This is
// stricter than the turf-operator rule above on purpose (a turf owner or staff
// member who is not the host cannot score someone else's tournament match).
// Only called for matches that carry a tournament_id.
export async function assertTournamentHost(tournamentId: string, userId: string): Promise<void> {
  const [row] = await sequelize.query<{ organiser_id: string }>(
    'SELECT organiser_id FROM tournaments WHERE tournament_id = :tournamentId',
    { type: QueryTypes.SELECT, replacements: { tournamentId } },
  );
  if (!row || row.organiser_id !== userId) {
    throw new ForbiddenActionError('Only the tournament host can run this match.');
  }
}
