// Exercises GET /admin/teams and PATCH /admin/teams/:teamId/status
// (backlog E-4). Only `sequelize` is faked — the real routes/services run
// unmodified.

interface TeamRow {
  team_id: string;
  team_name: string;
  home_city: string | null;
  skill_level: string | null;
  team_status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface UserRow {
  user_id: string;
  phone_number: string;
}

interface PlayerRow {
  user_id: string;
  full_name: string | null;
}

interface MemberRow {
  team_id: string;
  membership_status: string;
}

const ADMIN_ID = 'aaaaaaaa-0000-4000-8000-001101';
const CAPTAIN_USER_ID = 'bbbbbbbb-0000-4000-8000-001102';

let teams: TeamRow[];
let users: UserRow[];
let players: PlayerRow[];
let members: MemberRow[];
let auditLogs: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM teams t') && sql.includes('JOIN users u')) {
          return teams.map((t) => {
            const user = users.find((u) => u.user_id === t.created_by);
            const player = players.find((p) => p.user_id === t.created_by);
            const memberCount = members.filter(
              (m) => m.team_id === t.team_id && m.membership_status === 'ACTIVE',
            ).length;
            return {
              ...t,
              captain_name: player?.full_name ?? null,
              captain_phone: user?.phone_number ?? '',
              member_count: memberCount,
            };
          });
        }
        if (sql.includes('SELECT team_status FROM teams WHERE team_id')) {
          const t = teams.find((x) => x.team_id === r.teamId);
          return t ? [{ team_status: t.team_status }] : [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'teams') {
            const t = teams.find((x) => x.team_id === where.team_id);
            if (t) Object.assign(t, values);
          }
        },
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'audit_logs') auditLogs.push(...rows);
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(role: 'ADMIN' | 'PLAYER', userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('Admin Team Management (backlog E-4)', () => {
  beforeEach(() => {
    teams = [
      {
        team_id: 'team-1',
        team_name: 'Thunder Strikers',
        home_city: 'Rajkot',
        skill_level: 'INTERMEDIATE',
        team_status: 'ACTIVE',
        created_by: CAPTAIN_USER_ID,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    users = [{ user_id: CAPTAIN_USER_ID, phone_number: '+919876500001' }];
    players = [{ user_id: CAPTAIN_USER_ID, full_name: 'Karan Captain' }];
    members = [
      { team_id: 'team-1', membership_status: 'ACTIVE' },
      { team_id: 'team-1', membership_status: 'ACTIVE' },
      { team_id: 'team-1', membership_status: 'LEFT' },
    ];
    auditLogs = [];
  });

  describe('GET /admin/teams', () => {
    it('lists every team with its captain and active member count', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app).get('/admin/teams').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0]).toMatchObject({
        team_name: 'Thunder Strikers',
        captain_name: 'Karan Captain',
        member_count: 2,
      });
    });

    it('rejects a non-admin caller', async () => {
      const token = await tokenFor('PLAYER', CAPTAIN_USER_ID);
      const res = await request(app).get('/admin/teams').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /admin/teams/:teamId/status', () => {
    it('archives a team and writes an audit log entry', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .patch('/admin/teams/team-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ team_status: 'ARCHIVED' });

      expect(res.status).toBe(200);
      expect(res.body.team_status).toBe('ARCHIVED');
      expect(teams[0].team_status).toBe('ARCHIVED');
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toMatchObject({
        action: 'TEAM_STATUS_CHANGED',
        resource_id: 'team-1',
        actor_user_id: ADMIN_ID,
        actor_role: 'ADMIN',
      });
    });

    it('reactivates an archived team', async () => {
      teams[0].team_status = 'ARCHIVED';
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .patch('/admin/teams/team-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ team_status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(teams[0].team_status).toBe('ACTIVE');
    });

    it('returns 404 for an unknown team', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .patch('/admin/teams/not-a-real-team/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ team_status: 'ARCHIVED' });
      expect(res.status).toBe(404);
    });

    it('rejects an invalid status value', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .patch('/admin/teams/team-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ team_status: 'NOT_A_STATUS' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-admin caller', async () => {
      const token = await tokenFor('PLAYER', CAPTAIN_USER_ID);
      const res = await request(app)
        .patch('/admin/teams/team-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ team_status: 'ARCHIVED' });
      expect(res.status).toBe(403);
    });
  });
});
