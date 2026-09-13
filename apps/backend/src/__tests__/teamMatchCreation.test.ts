// Backlog G-20: Create Match can now take two real teams instead of always
// producing ad-hoc "Team A"/"Team B" sides. Exercises matchService directly
// (fetchBooking + sequelize are faked; teamService's real implementation
// runs against the same faked sequelize, same pattern as roomService.test.ts
// uses for its downstream services).

interface MatchRow {
  match_id: string;
  booking_id: string;
  match_name: string | null;
  organizer_id: string;
  match_type: string;
  ball_type: string;
  overs_per_innings: number;
  scoring_mode: string;
  assigned_scorer_id: string | null;
  match_status: string;
  visibility: string;
  scheduled_start_time: Date;
  actual_start_time: Date | null;
  actual_end_time: Date | null;
  check_in_code: string | null;
  created_at: Date;
  updated_at: Date;
}
interface MatchTeamRow {
  match_team_id: string;
  match_id: string;
  team_id: string | null;
  side_label: 'TEAM_A' | 'TEAM_B';
  created_at: Date;
}
interface MatchPlayerRow {
  match_player_id: string;
  match_id: string;
  player_id: string;
  match_team_id: string | null;
  participant_role: string;
  invitation_status: string;
  attendance_status: string;
  checked_in_at: Date | null;
  added_at: Date;
}
interface MatchInvitationRow {
  invitation_id: string;
  match_id: string;
  invited_player_id: string;
  invited_by: string;
  status: string;
  sent_at: Date;
  responded_at: Date | null;
  expires_at: Date | null;
}
interface TeamRow {
  team_id: string;
  team_name: string;
  team_status: string;
  deleted_at: Date | null;
}
interface TeamMemberRow {
  team_id: string;
  player_id: string;
  membership_status: string;
}
interface PlayerRow {
  user_id: string;
  player_id: string;
  bfam_id: string;
  full_name: string | null;
}

const ORGANIZER_USER = 'user-organizer';
const ORGANIZER_PLAYER = 'player-organizer';
const HOME2_USER = 'user-home-2';
const HOME2_PLAYER = 'player-home-2';
const AWAY1_USER = 'user-away-1';
const AWAY1_PLAYER = 'player-away-1';
const AWAY2_USER = 'user-away-2';
const AWAY2_PLAYER = 'player-away-2';
const HOME_TEAM = 'team-home';
const AWAY_TEAM = 'team-away';
const BOOKING_ID = 'booking-1';

const players: PlayerRow[] = [
  {
    user_id: ORGANIZER_USER,
    player_id: ORGANIZER_PLAYER,
    bfam_id: 'BF1001',
    full_name: 'Organizer',
  },
  { user_id: HOME2_USER, player_id: HOME2_PLAYER, bfam_id: 'BF1002', full_name: 'Home Two' },
  { user_id: AWAY1_USER, player_id: AWAY1_PLAYER, bfam_id: 'BF2001', full_name: 'Away One' },
  { user_id: AWAY2_USER, player_id: AWAY2_PLAYER, bfam_id: 'BF2002', full_name: 'Away Two' },
];
const teams: TeamRow[] = [
  { team_id: HOME_TEAM, team_name: 'Rajkot Royals', team_status: 'ACTIVE', deleted_at: null },
  { team_id: AWAY_TEAM, team_name: 'Night Owls CC', team_status: 'ACTIVE', deleted_at: null },
];
const teamMembers: TeamMemberRow[] = [
  { team_id: HOME_TEAM, player_id: ORGANIZER_PLAYER, membership_status: 'ACTIVE' },
  { team_id: HOME_TEAM, player_id: HOME2_PLAYER, membership_status: 'ACTIVE' },
  { team_id: AWAY_TEAM, player_id: AWAY1_PLAYER, membership_status: 'ACTIVE' },
  { team_id: AWAY_TEAM, player_id: AWAY2_PLAYER, membership_status: 'ACTIVE' },
];

let tables: {
  matches: MatchRow[];
  match_teams: MatchTeamRow[];
  match_players: MatchPlayerRow[];
  match_invitations: MatchInvitationRow[];
};

function resetTables() {
  tables = { matches: [], match_teams: [], match_players: [], match_invitations: [] };
}

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>) {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

// jest.config.js sets resetMocks: true, so a mockResolvedValue configured
// only here (at module-mock-definition time) would be wiped before the
// first test runs — every mock below is reconfigured in beforeEach instead,
// same pattern roomService.test.ts uses for its own createBooking mock.
jest.mock('../services/bookingService', () => ({
  getBookingById: jest.fn(),
}));
jest.mock('../services/notificationService', () => ({
  sendNotification: jest.fn(),
}));
jest.mock('../services/chatService', () => ({
  postSystemMessage: jest.fn(),
}));

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          const p = players.find((p) => p.user_id === r.userId);
          return p ? [{ player_id: p.player_id }] : [];
        }
        if (sql.includes('SELECT user_id, bfam_id FROM players WHERE player_id')) {
          const p = players.find((p) => p.player_id === r.playerId);
          return p ? [{ user_id: p.user_id, bfam_id: p.bfam_id }] : [];
        }
        if (sql.includes('SELECT bfam_id, full_name FROM players WHERE player_id')) {
          const p = players.find((p) => p.player_id === r.playerId);
          return p ? [{ bfam_id: p.bfam_id, full_name: p.full_name }] : [];
        }
        if (sql.includes('SELECT team_id FROM teams WHERE team_id')) {
          const t = teams.find((t) => t.team_id === r.teamId);
          return t ? [{ team_id: t.team_id }] : [];
        }
        if (sql.includes('FROM team_members WHERE team_id = :teamId AND player_id = :playerId')) {
          const m = teamMembers.find((m) => m.team_id === r.teamId && m.player_id === r.playerId);
          return m ? [m] : [];
        }
        if (
          sql.includes("FROM team_members WHERE team_id = :teamId AND membership_status = 'ACTIVE'")
        ) {
          return teamMembers
            .filter((m) => m.team_id === r.teamId && m.membership_status === 'ACTIVE')
            .map((m) => ({ player_id: m.player_id }));
        }
        if (sql.includes('SELECT * FROM matches WHERE match_id')) {
          const m = tables.matches.find((m) => m.match_id === r.matchId);
          return m ? [m] : [];
        }
        if (
          sql.includes(
            'SELECT * FROM match_players WHERE match_id = :matchId AND player_id = :playerId',
          )
        ) {
          const p = tables.match_players.find(
            (p) => p.match_id === r.matchId && p.player_id === r.playerId,
          );
          return p ? [p] : [];
        }
        if (sql.includes('SELECT match_team_id, team_id FROM match_teams WHERE match_id')) {
          return tables.match_teams
            .filter((t) => t.match_id === r.matchId)
            .map((t) => ({ match_team_id: t.match_team_id, team_id: t.team_id }));
        }
        if (sql.includes('SELECT * FROM match_invitations WHERE invitation_id')) {
          const inv = tables.match_invitations.find((i) => i.invitation_id === r.invitationId);
          return inv ? [inv] : [];
        }
        if (sql.includes('FROM player_replacements')) {
          return [];
        }
        if (sql.includes('FROM matches m') && sql.includes('IN_PROGRESS')) {
          return tables.matches
            .filter((m) => m.match_status === 'IN_PROGRESS' && m.visibility === 'PUBLIC')
            .map((m) => {
              const teamA = tables.match_teams.find(
                (t) => t.match_id === m.match_id && t.side_label === 'TEAM_A',
              );
              const teamB = tables.match_teams.find(
                (t) => t.match_id === m.match_id && t.side_label === 'TEAM_B',
              );
              const nameFor = (t: MatchTeamRow | undefined) =>
                t?.team_id
                  ? (teams.find((team) => team.team_id === t.team_id)?.team_name ?? null)
                  : null;
              return {
                ...m,
                turf_name: 'Test Turf',
                city: 'Rajkot',
                home_team_name: nameFor(teamA),
                away_team_name: nameFor(teamB),
              };
            });
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: keyof typeof tables, rows: Record<string, unknown>[]) => {
          (tables[table] as unknown as Record<string, unknown>[]).push(...rows);
        },
        bulkUpdate: async (
          table: keyof typeof tables,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          for (const row of tables[table] as unknown as Record<string, unknown>[]) {
            if (matchesWhere(row, where)) Object.assign(row, values);
          }
        },
      }),
    },
  };
});

import { createMatch, listLiveMatches, respondToMatchInvitation } from '../services/matchService';
import { getBookingById } from '../services/bookingService';
import { ForbiddenActionError, InvalidMatchStateError } from '../domain/errors';

function setUpMocks() {
  resetTables();
  (getBookingById as jest.Mock).mockResolvedValue({
    booking_id: BOOKING_ID,
    booked_by: ORGANIZER_USER,
    booking_status: 'CONFIRMED',
    booking_date: '2026-09-20',
    start_time: '18:00:00',
  });
}

describe('createMatch — team-vs-team (backlog G-20)', () => {
  beforeEach(() => {
    setUpMocks();
  });

  it('links both real teams, defaults to PUBLIC, auto-invites every other active member, and seats the organizer on the home side', async () => {
    const match = await createMatch(ORGANIZER_USER, {
      booking_id: BOOKING_ID,
      match_name: 'Derby',
      match_type: 'LEATHER_BALL',
      ball_type: 'LEATHER',
      overs_per_innings: 10,
      scoring_mode: 'SELF_SCORED',
      home_team_id: HOME_TEAM,
      away_team_id: AWAY_TEAM,
    });

    expect(match.visibility).toBe('PUBLIC');

    const teamA = tables.match_teams.find(
      (t) => t.match_id === match.match_id && t.side_label === 'TEAM_A',
    );
    const teamB = tables.match_teams.find(
      (t) => t.match_id === match.match_id && t.side_label === 'TEAM_B',
    );
    expect(teamA?.team_id).toBe(HOME_TEAM);
    expect(teamB?.team_id).toBe(AWAY_TEAM);

    const organizerRow = tables.match_players.find((p) => p.player_id === ORGANIZER_PLAYER);
    expect(organizerRow?.match_team_id).toBe(teamA?.match_team_id);
    expect(organizerRow?.invitation_status).toBe('CONFIRMED');

    const invitedIds = tables.match_invitations.map((i) => i.invited_player_id).sort();
    expect(invitedIds).toEqual([AWAY1_PLAYER, AWAY2_PLAYER, HOME2_PLAYER].sort());

    const home2Row = tables.match_players.find((p) => p.player_id === HOME2_PLAYER);
    expect(home2Row?.invitation_status).toBe('PENDING');
    expect(home2Row?.match_team_id).toBeNull();
  });

  it('rejects when the organizer is not an active member of the team picked as Your Team', async () => {
    // The organizer (per the mocked booking) is only ever a member of
    // HOME_TEAM — picking AWAY_TEAM as "Your Team" must be rejected even
    // though AWAY_TEAM itself is a perfectly real, active team.
    await expect(
      createMatch(ORGANIZER_USER, {
        booking_id: BOOKING_ID,
        match_type: 'LEATHER_BALL',
        ball_type: 'LEATHER',
        overs_per_innings: 10,
        scoring_mode: 'SELF_SCORED',
        home_team_id: AWAY_TEAM,
        away_team_id: HOME_TEAM,
      }),
    ).rejects.toThrow(ForbiddenActionError);
  });

  it('rejects picking the same team on both sides', async () => {
    await expect(
      createMatch(ORGANIZER_USER, {
        booking_id: BOOKING_ID,
        match_type: 'LEATHER_BALL',
        ball_type: 'LEATHER',
        overs_per_innings: 10,
        scoring_mode: 'SELF_SCORED',
        home_team_id: HOME_TEAM,
        away_team_id: HOME_TEAM,
      }),
    ).rejects.toThrow(InvalidMatchStateError);
  });

  it('stays an ad-hoc PRIVATE match when no teams are picked', async () => {
    const match = await createMatch(ORGANIZER_USER, {
      booking_id: BOOKING_ID,
      match_type: 'LEATHER_BALL',
      ball_type: 'LEATHER',
      overs_per_innings: 10,
      scoring_mode: 'SELF_SCORED',
    });

    expect(match.visibility).toBe('PRIVATE');
    expect(tables.match_invitations).toHaveLength(0);
    const teamA = tables.match_teams.find(
      (t) => t.match_id === match.match_id && t.side_label === 'TEAM_A',
    );
    expect(teamA?.team_id).toBeNull();
  });
});

describe('respondToMatchInvitation — auto side assignment (backlog G-20)', () => {
  beforeEach(() => {
    setUpMocks();
  });

  it("puts a confirming player straight onto their team's side, with no manual assignment step", async () => {
    const match = await createMatch(ORGANIZER_USER, {
      booking_id: BOOKING_ID,
      match_type: 'LEATHER_BALL',
      ball_type: 'LEATHER',
      overs_per_innings: 10,
      scoring_mode: 'SELF_SCORED',
      home_team_id: HOME_TEAM,
      away_team_id: AWAY_TEAM,
    });
    const teamB = tables.match_teams.find(
      (t) => t.match_id === match.match_id && t.side_label === 'TEAM_B',
    );
    const invitation = tables.match_invitations.find((i) => i.invited_player_id === AWAY1_PLAYER)!;

    await respondToMatchInvitation(invitation.invitation_id, AWAY1_USER, 'CONFIRMED');

    const away1Row = tables.match_players.find((p) => p.player_id === AWAY1_PLAYER);
    expect(away1Row?.invitation_status).toBe('CONFIRMED');
    expect(away1Row?.match_team_id).toBe(teamB?.match_team_id);
  });

  it('leaves match_team_id null for an ad-hoc match with no linked teams', async () => {
    const match = await createMatch(ORGANIZER_USER, {
      booking_id: BOOKING_ID,
      match_type: 'LEATHER_BALL',
      ball_type: 'LEATHER',
      overs_per_innings: 10,
      scoring_mode: 'SELF_SCORED',
    });
    tables.match_invitations.push({
      invitation_id: 'inv-adhoc-1',
      match_id: match.match_id,
      invited_player_id: HOME2_PLAYER,
      invited_by: ORGANIZER_USER,
      status: 'PENDING',
      sent_at: new Date(),
      responded_at: null,
      expires_at: null,
    });
    tables.match_players.push({
      match_player_id: 'mp-adhoc-1',
      match_id: match.match_id,
      player_id: HOME2_PLAYER,
      match_team_id: null,
      participant_role: 'PLAYER',
      invitation_status: 'PENDING',
      attendance_status: 'PENDING',
      checked_in_at: null,
      added_at: new Date(),
    });

    await respondToMatchInvitation('inv-adhoc-1', HOME2_USER, 'CONFIRMED');

    const row = tables.match_players.find((p) => p.player_id === HOME2_PLAYER);
    expect(row?.invitation_status).toBe('CONFIRMED');
    expect(row?.match_team_id).toBeNull();
  });
});

describe('listLiveMatches — Live Now discovery (backlog G-20)', () => {
  beforeEach(() => {
    setUpMocks();
  });

  it('returns only PUBLIC, in-progress matches, with both team names resolved', async () => {
    const teamMatch = await createMatch(ORGANIZER_USER, {
      booking_id: BOOKING_ID,
      match_type: 'LEATHER_BALL',
      ball_type: 'LEATHER',
      overs_per_innings: 10,
      scoring_mode: 'SELF_SCORED',
      home_team_id: HOME_TEAM,
      away_team_id: AWAY_TEAM,
    });
    const stillOpenTeamMatch = tables.matches.find((m) => m.match_id === teamMatch.match_id)!;
    stillOpenTeamMatch.match_status = 'IN_PROGRESS';

    const results = await listLiveMatches();

    expect(results).toHaveLength(1);
    expect(results[0].match_id).toBe(teamMatch.match_id);
    expect(results[0].home_team_name).toBe('Rajkot Royals');
    expect(results[0].away_team_name).toBe('Night Owls CC');
  });

  it('excludes a PRIVATE ad-hoc match even if it is in progress', async () => {
    const adhoc = await createMatch(ORGANIZER_USER, {
      booking_id: BOOKING_ID,
      match_type: 'LEATHER_BALL',
      ball_type: 'LEATHER',
      overs_per_innings: 10,
      scoring_mode: 'SELF_SCORED',
    });
    tables.matches.find((m) => m.match_id === adhoc.match_id)!.match_status = 'IN_PROGRESS';

    const results = await listLiveMatches();

    expect(results).toHaveLength(0);
  });
});
