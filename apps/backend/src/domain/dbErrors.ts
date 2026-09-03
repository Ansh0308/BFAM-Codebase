import { UniqueConstraintError } from 'sequelize';

// Shared across services that rely on a DB unique constraint/index to
// enforce a business rule under concurrency (PRD §15) — e.g. bookings'
// no-double-booking slot key, teams' one-active-captain generated column,
// team_members' one-row-per-(team,player) constraint. A caught violation
// here means the race was real and the DB, not application code, is what
// actually decided the outcome — the caller's job is just to turn it into
// a clean response instead of leaking the raw driver error.
export function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof UniqueConstraintError) return true;
  const name = (error as { name?: string } | undefined)?.name;
  return name === 'SequelizeUniqueConstraintError';
}
