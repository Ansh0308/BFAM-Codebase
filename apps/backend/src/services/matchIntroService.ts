import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { getIo, matchRoom } from '../realtime/io';
import {
  ForbiddenActionError,
  MatchIntroNotFoundError,
  MatchNotFoundError,
} from '../domain/errors';

interface MatchRow {
  match_id: string;
  booking_id: string;
  organizer_id: string;
  assigned_scorer_id: string | null;
}

interface MatchIntroRow {
  intro_id: string;
  match_id: string;
  countdown_enabled: boolean;
  background_music_enabled: boolean;
  playing_xi_confirmed_team_a: boolean;
  playing_xi_confirmed_team_b: boolean;
  toss_winner_match_team_id: string | null;
  toss_decision: 'BAT' | 'BOWL' | null;
  toss_completed_at: Date | null;
  intro_played_at: Date | null;
}

interface PlayingXiPlayer {
  player_id: string;
  bfam_id: string;
  participant_role: string;
  side_label: string | null;
}

async function fetchMatch(matchId: string): Promise<MatchRow | null> {
  const [match] = await sequelize.query<MatchRow>(
    'SELECT match_id, booking_id, organizer_id, assigned_scorer_id FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return match ?? null;
}

async function assertCanManage(match: MatchRow, actorUserId: string) {
  if (match.organizer_id === actorUserId || match.assigned_scorer_id === actorUserId) return;
  throw new ForbiddenActionError('Only the match organizer or assigned scorer can do that.');
}

async function fetchIntro(matchId: string): Promise<MatchIntroRow | null> {
  const [row] = await sequelize.query<MatchIntroRow>(
    'SELECT * FROM match_intro WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return row ?? null;
}

// Playing XI (PRD §12.61 requirement 3): derived live from match_players
// where invitation_status = 'CONFIRMED' — never hardcoded/separately
// stored, so it's always exactly whoever is actually confirmed right now.
// side_label will be null for everyone until a "assign player to side"
// step exists (no prior module builds one — match_players.match_team_id
// is set to null at creation and never populated) — the mobile reveal
// screen shows a single unified list rather than pretending it can split
// by team.
async function getPlayingXi(matchId: string): Promise<PlayingXiPlayer[]> {
  return sequelize.query<PlayingXiPlayer>(
    `SELECT mp.player_id, p.bfam_id, mp.participant_role, mt.side_label
     FROM match_players mp
     JOIN players p ON p.player_id = mp.player_id
     LEFT JOIN match_teams mt ON mt.match_team_id = mp.match_team_id
     WHERE mp.match_id = :matchId AND mp.invitation_status = 'CONFIRMED'
     ORDER BY mp.participant_role ASC, mp.added_at ASC`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
}

interface MatchTeamRow {
  match_team_id: string;
  side_label: 'TEAM_A' | 'TEAM_B';
}

// Toss capture needs a real match_team_id per side — always available
// (createMatch always makes two ad-hoc TEAM_A/TEAM_B rows), independent
// of whether individual players have been assigned to a side yet (no
// prior module builds that assignment step, so match_players.match_team_id
// is null for everyone in this MVP — see getPlayingXi's comment).
async function getMatchTeams(matchId: string): Promise<MatchTeamRow[]> {
  return sequelize.query<MatchTeamRow>(
    'SELECT match_team_id, side_label FROM match_teams WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
}

async function getStadiumSoundEnabled(bookingId: string): Promise<boolean> {
  const [row] = await sequelize.query<{ stadium_sound_enabled: boolean }>(
    `SELECT t.stadium_sound_enabled
     FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
     WHERE b.booking_id = :bookingId`,
    { type: QueryTypes.SELECT, replacements: { bookingId } },
  );
  return row?.stadium_sound_enabled ?? true;
}

function broadcastStage(matchId: string, stage: string, data: unknown) {
  getIo()?.to(matchRoom(matchId)).emit('match:intro_stage', { matchId, stage, data });
}

// Start Match (PRD §12.61 requirement 1): creates the match_intro record.
// Idempotent — this is a one-time sequence, so re-entering (e.g. the
// organizer's app backgrounded and they tap Start Match again) just
// resumes the existing record instead of erroring or duplicating it.
export async function startIntro(matchId: string, actorUserId: string) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);

  let intro = await fetchIntro(matchId);
  if (!intro) {
    const introId = randomUUID();
    const backgroundMusicEnabled = await getStadiumSoundEnabled(match.booking_id);
    await sequelize.getQueryInterface().bulkInsert('match_intro', [
      {
        intro_id: introId,
        match_id: matchId,
        countdown_enabled: true,
        background_music_enabled: backgroundMusicEnabled,
        playing_xi_confirmed_team_a: false,
        playing_xi_confirmed_team_b: false,
        toss_winner_match_team_id: null,
        toss_decision: null,
        toss_completed_at: null,
        intro_played_at: new Date(),
      },
    ]);
    intro = await fetchIntro(matchId);
  }

  const [players, matchTeams] = await Promise.all([getPlayingXi(matchId), getMatchTeams(matchId)]);
  broadcastStage(matchId, 'COUNTDOWN', { players });
  return { intro, players, matchTeams };
}

export async function getIntroContext(matchId: string) {
  const intro = await fetchIntro(matchId);
  if (!intro) throw new MatchIntroNotFoundError(matchId);
  const [players, matchTeams] = await Promise.all([getPlayingXi(matchId), getMatchTeams(matchId)]);
  return { intro, players, matchTeams };
}

// Playing XI reveal confirmation — the derived CONFIRMED roster IS the XI
// (no separate lineup-building step in this MVP), so "confirming" per
// side just flips the flag once its captain has seen the reveal.
export async function confirmPlayingXi(
  matchId: string,
  actorUserId: string,
  side: 'TEAM_A' | 'TEAM_B',
) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);

  const column = side === 'TEAM_A' ? 'playing_xi_confirmed_team_a' : 'playing_xi_confirmed_team_b';
  await sequelize
    .getQueryInterface()
    .bulkUpdate('match_intro', { [column]: true }, { match_id: matchId });

  const players = await getPlayingXi(matchId);
  broadcastStage(matchId, 'XI_REVEAL', { players });
  return { players };
}

// Toss result capture + display (PRD §12.61 requirement 5).
export async function recordToss(
  matchId: string,
  actorUserId: string,
  tossWinnerMatchTeamId: string,
  decision: 'BAT' | 'BOWL',
) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);

  const now = new Date();
  await sequelize.getQueryInterface().bulkUpdate(
    'match_intro',
    {
      toss_winner_match_team_id: tossWinnerMatchTeamId,
      toss_decision: decision,
      toss_completed_at: now,
    },
    { match_id: matchId },
  );

  const payload = { toss_winner_match_team_id: tossWinnerMatchTeamId, toss_decision: decision };
  broadcastStage(matchId, 'TOSS', payload);
  return payload;
}

// The sequence's final stage — hands off to Live Scoring (module 2.8).
// Module 2.7's own scope ends here; this just emits so viewers transition
// their screen away from the intro in sync.
export async function completeIntro(matchId: string, actorUserId: string) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);
  broadcastStage(matchId, 'DONE', {});
}
