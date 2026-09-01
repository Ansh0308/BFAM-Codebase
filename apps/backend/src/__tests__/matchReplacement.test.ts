// API integration tests for module 2.6's Player Replacement flow (PRD
// §12.15): vacancy → suggested players → invite → accept, and its
// atomicity guarantee — a vacancy is never marked FILLED without the
// designated candidate actually being CONFIRMED on the roster, and only
// the designated candidate can accept it. Only `sequelize` is faked — the
// real routes/services run unmodified.

interface BookingRow {
  booking_id: string;
  turf_id: string;
  booked_by: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  booking_amount: string;
  booking_status: string;
  payment_mode: string;
}
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
}
interface ReplacementRow {
  replacement_id: string;
  match_id: string;
  vacating_player_id: string;
  replacement_player_id: string | null;
  initiated_by: string;
  status: string;
  created_at: Date;
  resolved_at: Date | null;
}
interface TeamRow {
  team_id: string;
  created_by: string;
}
interface TeamMemberRow {
  team_id: string;
  player_id: string;
  membership_status: string;
}
interface PlayerRow {
  player_id: string;
  user_id: string;
  bfam_id: string;
}

const ORGANIZER_USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORGANIZER_PLAYER = 'aaaaaaaa-1111-4000-8000-000000000001';
const VACATING_USER = 'bbbbbbbb-0000-4000-8000-000000000002';
const VACATING_PLAYER = 'bbbbbbbb-1111-4000-8000-000000000002';
const CANDIDATE_USER = 'cccccccc-0000-4000-8000-000000000003';
const CANDIDATE_PLAYER = 'cccccccc-1111-4000-8000-000000000003';
const OUTSIDER_USER = 'dddddddd-0000-4000-8000-000000000004';
const OUTSIDER_PLAYER = 'dddddddd-1111-4000-8000-000000000004';

const players: PlayerRow[] = [
  { player_id: ORGANIZER_PLAYER, user_id: ORGANIZER_USER, bfam_id: 'BF1000' },
  { player_id: VACATING_PLAYER, user_id: VACATING_USER, bfam_id: 'BF1001' },
  { player_id: CANDIDATE_PLAYER, user_id: CANDIDATE_USER, bfam_id: 'BF1002' },
  { player_id: OUTSIDER_PLAYER, user_id: OUTSIDER_USER, bfam_id: 'BF1003' },
];

let bookings: BookingRow[] = [];
let matches: MatchRow[] = [];
let matchPlayers: MatchPlayerRow[] = [];
let matchInvitations: MatchInvitationRow[] = [];
let replacements: ReplacementRow[] = [];
let teams: TeamRow[] = [];
let teamMembers: TeamMemberRow[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          const p = players.find((x) => x.user_id === r.userId);
          return p ? [p] : [];
        }
        if (sql.includes('FROM bookings WHERE booking_id')) {
          const b = bookings.find((x) => x.booking_id === r.bookingId);
          return b ? [b] : [];
        }
        if (sql.includes('FROM matches WHERE match_id')) {
          const m = matches.find((x) => x.match_id === r.matchId);
          return m ? [m] : [];
        }
        if (sql.includes('FROM match_players WHERE match_id = :matchId AND player_id')) {
          const m = matchPlayers.find(
            (x) => x.match_id === r.matchId && x.player_id === r.playerId,
          );
          return m ? [m] : [];
        }
        if (sql.includes('FROM match_invitations WHERE invitation_id')) {
          const i = matchInvitations.find((x) => x.invitation_id === r.invitationId);
          return i ? [i] : [];
        }
        if (sql.includes('FROM player_replacements WHERE replacement_id')) {
          const rep = replacements.find((x) => x.replacement_id === r.replacementId);
          return rep ? [rep] : [];
        }
        if (sql.includes("replacement_player_id = :playerId AND status = 'OPEN'")) {
          const rep = replacements.find(
            (x) =>
              x.match_id === r.matchId &&
              x.replacement_player_id === r.playerId &&
              x.status === 'OPEN',
          );
          return rep ? [{ replacement_id: rep.replacement_id }] : [];
        }
        if (sql.includes('FROM team_members tm') && sql.includes('JOIN teams t')) {
          const organizerId = r.organizerId;
          const matchId = r.matchId as string;
          const rosterExcluded = new Set(
            matchPlayers
              .filter(
                (mp) =>
                  mp.match_id === matchId &&
                  !['CANT_PLAY', 'NO_RESPONSE'].includes(mp.invitation_status),
              )
              .map((mp) => mp.player_id),
          );
          return teams
            .filter((t) => t.created_by === organizerId)
            .flatMap((t) =>
              teamMembers
                .filter((tm) => tm.team_id === t.team_id && tm.membership_status === 'ACTIVE')
                .filter((tm) => !rosterExcluded.has(tm.player_id))
                .map((tm) => {
                  const p = players.find((x) => x.player_id === tm.player_id)!;
                  return { player_id: p.player_id, bfam_id: p.bfam_id, team_name: 'Test Team' };
                }),
            );
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'matches') matches.push(...(rows as unknown as MatchRow[]));
          if (table === 'match_teams') {
            /* not needed by these tests */
          }
          if (table === 'match_players')
            matchPlayers.push(...(rows as unknown as MatchPlayerRow[]));
          if (table === 'match_invitations')
            matchInvitations.push(...(rows as unknown as MatchInvitationRow[]));
          if (table === 'player_replacements')
            replacements.push(...(rows as unknown as ReplacementRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'match_players') {
            for (const mp of matchPlayers) {
              const matches =
                where.match_player_id !== undefined
                  ? mp.match_player_id === where.match_player_id
                  : mp.match_id === where.match_id && mp.player_id === where.player_id;
              if (matches) Object.assign(mp, values);
            }
          }
          if (table === 'player_replacements') {
            const rep = replacements.find((x) => x.replacement_id === where.replacement_id);
            if (rep) Object.assign(rep, values);
          }
          if (table === 'match_invitations') {
            const inv = matchInvitations.find((x) => x.invitation_id === where.invitation_id);
            if (inv) Object.assign(inv, values);
          }
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('Match Player Replacement flow (module 2.6)', () => {
  let matchId: string;
  let vacatingMatchPlayerId: string;

  beforeEach(async () => {
    bookings = [
      {
        booking_id: 'eeeeeeee-0000-4000-8000-000000000099',
        turf_id: 'turf-1',
        booked_by: ORGANIZER_USER,
        booking_date: '2026-09-10',
        start_time: '18:00:00',
        end_time: '19:00:00',
        duration_minutes: 60,
        booking_amount: '1000.00',
        booking_status: 'CONFIRMED',
        payment_mode: 'UPI',
      },
    ];
    matches = [];
    matchPlayers = [];
    matchInvitations = [];
    replacements = [];
    teams = [{ team_id: 'team-1', created_by: ORGANIZER_USER }];
    teamMembers = [
      { team_id: 'team-1', player_id: CANDIDATE_PLAYER, membership_status: 'ACTIVE' },
      { team_id: 'team-1', player_id: OUTSIDER_PLAYER, membership_status: 'LEFT' }, // inactive — must be excluded
    ];

    const organizerToken = await tokenFor(ORGANIZER_USER);
    const created = await request(app)
      .post('/matches')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        booking_id: 'eeeeeeee-0000-4000-8000-000000000099',
        match_type: 'FRIENDS',
        ball_type: 'TENNIS',
        overs_per_innings: 8,
        scoring_mode: 'PLAYER_MANAGED',
      });
    expect(created.status).toBe(201);
    matchId = created.body.match_id;

    vacatingMatchPlayerId = 'seed-mp-1';
    matchPlayers.push({
      match_player_id: vacatingMatchPlayerId,
      match_id: matchId,
      player_id: VACATING_PLAYER,
      match_team_id: null,
      participant_role: 'PLAYER',
      invitation_status: 'CONFIRMED',
      attendance_status: 'PENDING',
      checked_in_at: null,
      added_at: new Date(),
    });
  });

  it('creating a match makes the organizer its sole CONFIRMED Captain', () => {
    const organizerRow = matchPlayers.find((mp) => mp.player_id === ORGANIZER_PLAYER);
    expect(organizerRow?.participant_role).toBe('CAPTAIN');
    expect(organizerRow?.invitation_status).toBe('CONFIRMED');
  });

  describe('vacancy → suggested players → invite → accept', () => {
    it('opening a vacancy moves the vacating player to CANT_PLAY and creates an OPEN replacement', async () => {
      const token = await tokenFor(ORGANIZER_USER);
      const res = await request(app)
        .post(`/matches/${matchId}/players/${VACATING_PLAYER}/vacate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      const replacementId = res.body.replacement_id;
      expect(replacements.find((r) => r.replacement_id === replacementId)?.status).toBe('OPEN');
      expect(
        matchPlayers.find((mp) => mp.match_player_id === vacatingMatchPlayerId)?.invitation_status,
      ).toBe('CANT_PLAY');
    });

    it('suggests active team-mates of the organizer who are not already on the roster', async () => {
      const organizerToken = await tokenFor(ORGANIZER_USER);
      const vacate = await request(app)
        .post(`/matches/${matchId}/players/${VACATING_PLAYER}/vacate`)
        .set('Authorization', `Bearer ${organizerToken}`);
      const replacementId = vacate.body.replacement_id;

      const suggestions = await request(app)
        .get(`/matches/replacements/${replacementId}/suggestions`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(suggestions.status).toBe(200);
      const suggestedIds = suggestions.body.results.map((s: { player_id: string }) => s.player_id);
      expect(suggestedIds).toContain(CANDIDATE_PLAYER);
      expect(suggestedIds).not.toContain(OUTSIDER_PLAYER); // LEFT membership — excluded
      expect(suggestedIds).not.toContain(VACATING_PLAYER); // already on roster (as CANT_PLAY, still listed)
    });

    it('the full pipeline atomically fills the vacancy: FILLED status and CONFIRMED roster happen together', async () => {
      const organizerToken = await tokenFor(ORGANIZER_USER);
      const candidateToken = await tokenFor(CANDIDATE_USER);

      const vacate = await request(app)
        .post(`/matches/${matchId}/players/${VACATING_PLAYER}/vacate`)
        .set('Authorization', `Bearer ${organizerToken}`);
      const replacementId = vacate.body.replacement_id;

      const invite = await request(app)
        .post(`/matches/replacements/${replacementId}/invite`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ player_id: CANDIDATE_PLAYER });
      expect(invite.status).toBe(204);
      expect(
        replacements.find((r) => r.replacement_id === replacementId)?.replacement_player_id,
      ).toBe(CANDIDATE_PLAYER);
      // Candidate is now on the roster as PENDING, invited via the normal flow.
      expect(
        matchPlayers.find((mp) => mp.match_id === matchId && mp.player_id === CANDIDATE_PLAYER)
          ?.invitation_status,
      ).toBe('PENDING');

      const accept = await request(app)
        .post(`/matches/replacements/${replacementId}/accept`)
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(accept.status).toBe(204);

      expect(replacements.find((r) => r.replacement_id === replacementId)?.status).toBe('FILLED');
      expect(
        matchPlayers.find((mp) => mp.match_id === matchId && mp.player_id === CANDIDATE_PLAYER)
          ?.invitation_status,
      ).toBe('CONFIRMED');
    });

    it('responding CONFIRMED to the ordinary invitation also fills the vacancy — no separate "accept replacement" step needed', async () => {
      const organizerToken = await tokenFor(ORGANIZER_USER);
      const candidateToken = await tokenFor(CANDIDATE_USER);

      const vacate = await request(app)
        .post(`/matches/${matchId}/players/${VACATING_PLAYER}/vacate`)
        .set('Authorization', `Bearer ${organizerToken}`);
      const replacementId = vacate.body.replacement_id;

      await request(app)
        .post(`/matches/replacements/${replacementId}/invite`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ player_id: CANDIDATE_PLAYER });

      const invitation = matchInvitations.find((i) => i.invited_player_id === CANDIDATE_PLAYER)!;

      const respond = await request(app)
        .post(`/matches/invitations/${invitation.invitation_id}/respond`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ response: 'CONFIRMED' });

      expect(respond.status).toBe(200);
      expect(replacements.find((r) => r.replacement_id === replacementId)?.status).toBe('FILLED');
      expect(
        matchPlayers.find((mp) => mp.match_id === matchId && mp.player_id === CANDIDATE_PLAYER)
          ?.invitation_status,
      ).toBe('CONFIRMED');
    });

    it('rejects an outsider accepting a replacement they were not invited to fill', async () => {
      const organizerToken = await tokenFor(ORGANIZER_USER);
      const outsiderToken = await tokenFor(OUTSIDER_USER);

      const vacate = await request(app)
        .post(`/matches/${matchId}/players/${VACATING_PLAYER}/vacate`)
        .set('Authorization', `Bearer ${organizerToken}`);
      const replacementId = vacate.body.replacement_id;

      await request(app)
        .post(`/matches/replacements/${replacementId}/invite`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ player_id: CANDIDATE_PLAYER });

      const res = await request(app)
        .post(`/matches/replacements/${replacementId}/accept`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(replacements.find((r) => r.replacement_id === replacementId)?.status).toBe('OPEN');
    });

    it('rejects accepting a replacement that has already been filled — never left dangling as neither OPEN nor consistent', async () => {
      const organizerToken = await tokenFor(ORGANIZER_USER);
      const candidateToken = await tokenFor(CANDIDATE_USER);

      const vacate = await request(app)
        .post(`/matches/${matchId}/players/${VACATING_PLAYER}/vacate`)
        .set('Authorization', `Bearer ${organizerToken}`);
      const replacementId = vacate.body.replacement_id;

      await request(app)
        .post(`/matches/replacements/${replacementId}/invite`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ player_id: CANDIDATE_PLAYER });
      await request(app)
        .post(`/matches/replacements/${replacementId}/accept`)
        .set('Authorization', `Bearer ${candidateToken}`);

      const secondAccept = await request(app)
        .post(`/matches/replacements/${replacementId}/accept`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(secondAccept.status).toBe(409);
    });

    it('only the organizer/scorer can open a vacancy for someone else', async () => {
      const outsiderToken = await tokenFor(OUTSIDER_USER);
      const res = await request(app)
        .post(`/matches/${matchId}/players/${VACATING_PLAYER}/vacate`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(
        matchPlayers.find((mp) => mp.match_player_id === vacatingMatchPlayerId)?.invitation_status,
      ).toBe('CONFIRMED');
    });
  });
});
