import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Backlog E-6 — Reports / Business Analytics in Admin Web (PRD §12.49).
// Different shape from E-2/E-3/E-4/E-5: those were each "add a directory +
// moderation action" over an existing service. Nothing resembling
// aggregate business metrics exists anywhere in the app yet, so this is a
// real first build, not a relaxed ownership check.
//
// Scoping decision (no founder available — see RESUME_STATE.md): this is
// a deliberately small first cut of PRD §12.49's ask — total bookings,
// revenue, cancellation rate, and the active-entity counts an admin would
// actually check day to day — not the full analytics platform (trends
// over custom date ranges, per-turf/per-owner breakdowns, exports) that
// §12.49/§12.50 imply eventually. Each number is one independent
// aggregate query rather than a single join across unrelated tables,
// since joining bookings/payments/matches/teams together would fan out
// and double-count rows that have no real relationship to each other.
export interface BusinessReport {
  total_bookings: number;
  cancelled_bookings: number;
  cancellation_rate: number;
  total_revenue: number;
  total_refunds: number;
  active_players: number;
  active_turfs: number;
  active_teams: number;
  matches_completed: number;
}

async function scalarCount(sql: string): Promise<number> {
  const [row] = await sequelize.query<{ count: number | string }>(sql, { type: QueryTypes.SELECT });
  return Number(row?.count ?? 0);
}

async function scalarSum(sql: string): Promise<number> {
  const [row] = await sequelize.query<{ total: number | string | null }>(sql, {
    type: QueryTypes.SELECT,
  });
  return Number(row?.total ?? 0);
}

export async function getBusinessReport(): Promise<BusinessReport> {
  const [
    totalBookings,
    cancelledBookings,
    totalRevenue,
    totalRefunds,
    activePlayers,
    activeTurfs,
    activeTeams,
    matchesCompleted,
  ] = await Promise.all([
    scalarCount('SELECT COUNT(*) AS count FROM bookings'),
    scalarCount("SELECT COUNT(*) AS count FROM bookings WHERE booking_status = 'CANCELLED'"),
    scalarSum("SELECT SUM(amount) AS total FROM payments WHERE payment_status = 'SUCCESS'"),
    scalarSum("SELECT SUM(refund_amount) AS total FROM refunds WHERE refund_status = 'COMPLETED'"),
    scalarCount(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'PLAYER' AND account_status = 'ACTIVE' AND deleted_at IS NULL",
    ),
    scalarCount(
      "SELECT COUNT(*) AS count FROM turfs WHERE turf_status = 'ACTIVE' AND deleted_at IS NULL",
    ),
    scalarCount(
      "SELECT COUNT(*) AS count FROM teams WHERE team_status = 'ACTIVE' AND deleted_at IS NULL",
    ),
    scalarCount("SELECT COUNT(*) AS count FROM matches WHERE match_status = 'COMPLETED'"),
  ]);

  return {
    total_bookings: totalBookings,
    cancelled_bookings: cancelledBookings,
    cancellation_rate:
      totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 10000) / 100 : 0,
    total_revenue: totalRevenue,
    total_refunds: totalRefunds,
    active_players: activePlayers,
    active_turfs: activeTurfs,
    active_teams: activeTeams,
    matches_completed: matchesCompleted,
  };
}
