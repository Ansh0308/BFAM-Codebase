import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

export interface AdminPlayerRow {
  user_id: string;
  bfam_id: string;
  phone_number: string;
  email: string | null;
  city: string | null;
  account_status: string;
  playing_role: string | null;
  batting_style: string | null;
  experience_level: string;
  skill_rating: number;
  reliability_score: number;
  favorite_cricketer_name: string | null;
  created_at: Date;
}

// Admin Web (PRD §9.1 "User management") — every registered PLAYER
// account, newest first. Deliberately PLAYER-only (not owners/staff/
// admins) since that's the roster Admin Web's player directory is for;
// TURF_OWNER/TURF_STAFF accounts are managed through their own turf
// context, not a flat list.
export async function listAllPlayers(): Promise<AdminPlayerRow[]> {
  return sequelize.query<AdminPlayerRow>(
    `SELECT u.user_id, p.bfam_id, u.phone_number, u.email, u.city, u.account_status,
            p.playing_role, p.batting_style, p.experience_level, p.skill_rating,
            p.reliability_score, p.favorite_cricketer_name, u.created_at
     FROM users u
     JOIN players p ON p.user_id = u.user_id
     WHERE u.role = 'PLAYER' AND u.deleted_at IS NULL
     ORDER BY u.created_at DESC`,
    { type: QueryTypes.SELECT },
  );
}
