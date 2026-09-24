import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { TeamNotFoundError } from '../domain/errors';
import { writeAuditLog } from './auditLogService';

// Backlog E-4 — Team Management in Admin Web (PRD §9.1). Same shape as
// E-3/E-5: Admin Web has no team visibility at all today, and teams.team_
// status (ACTIVE/INACTIVE/ARCHIVED) has existed since phase 1 but nothing
// anywhere ever sets it to anything but ACTIVE — a problem team (abusive
// name, fraudulent activity) can never actually be taken down. What's
// needed: a directory across every team (not scoped to "teams I'm on",
// which is all the player-facing surface offers), and archive/reactivate
// moderation.
export interface AdminTeamRow {
  team_id: string;
  team_name: string;
  home_city: string | null;
  skill_level: string | null;
  team_status: string;
  captain_name: string | null;
  captain_phone: string;
  member_count: number;
  created_at: Date;
}

export async function listAllTeamsForAdmin(): Promise<AdminTeamRow[]> {
  return sequelize.query<AdminTeamRow>(
    `SELECT t.team_id, t.team_name, t.home_city, t.skill_level, t.team_status,
            p.full_name AS captain_name, u.phone_number AS captain_phone,
            (SELECT COUNT(*) FROM team_members tm
             WHERE tm.team_id = t.team_id AND tm.membership_status = 'ACTIVE') AS member_count,
            t.created_at
     FROM teams t
     JOIN users u ON u.user_id = t.created_by
     LEFT JOIN players p ON p.user_id = t.created_by
     WHERE t.deleted_at IS NULL
     ORDER BY t.created_at DESC`,
    { type: QueryTypes.SELECT },
  );
}

export async function setTeamStatusAsAdmin(
  teamId: string,
  newStatus: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
  actorUserId: string,
): Promise<AdminTeamRow> {
  const [team] = await sequelize.query<{ team_status: string }>(
    'SELECT team_status FROM teams WHERE team_id = :teamId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { teamId } },
  );
  if (!team) throw new TeamNotFoundError(teamId);

  await sequelize
    .getQueryInterface()
    .bulkUpdate('teams', { team_status: newStatus, updated_at: new Date() }, { team_id: teamId });

  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'TEAM_STATUS_CHANGED',
    resourceType: 'team',
    resourceId: teamId,
    beforeData: { team_status: team.team_status },
    afterData: { team_status: newStatus },
  });

  const [updated] = await listAllTeamsForAdmin().then((rows) =>
    rows.filter((r) => r.team_id === teamId),
  );
  return updated;
}
