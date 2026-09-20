// Comprehensive demo dataset for exercising the mobile app end-to-end —
// realistic (not random-garbage) data across turfs, players, teams,
// bookings, matches at every stage (open roster, fully confirmed but not
// started, a match LIVE right now with a real innings in progress, and a
// fully completed match with two full innings scored ball-by-ball),
// payments, and notifications.
//
// Simple entities (users/players/teams/turfs) are inserted directly.
// Everything with real business logic behind it (bookings, matches,
// invites, the intro sequence, ball-by-ball scoring, payments) is driven
// through this codebase's own tested service functions instead of
// hand-crafted SQL rows — so cached totals, sequence numbers, and audio
// triggers are exactly as consistent as they'd be through the real API,
// not just plausible-looking.
//
// Run with: npm run db:seed:demo --workspace=apps/backend
// Safe to re-run: uses fresh phone numbers each run is NOT idempotent by
// design (this is throwaway demo data) — see the cleanup note printed at
// the end if you want to wipe and reseed.

import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { createBooking } from '../services/bookingService';
import { createObligationsForBooking, recordCashPayment } from '../services/paymentService';
import { createTeam, inviteToTeam, respondToInvitation } from '../services/teamService';
import { createMatch, inviteToMatch, respondToMatchInvitation } from '../services/matchService';
import {
  completeIntro,
  confirmPlayingXi,
  recordToss,
  startIntro,
} from '../services/matchIntroService';
import { finalizeMatch, recordBall, startInnings } from '../services/scoringService';

const now = new Date();
const PASSWORD = 'Demo@1234';
const RUN_TAG = Date.now().toString().slice(-6); // keeps phone numbers unique across reseeds

async function insert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  await sequelize.getQueryInterface().bulkInsert(table, rows);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface SeedUser {
  user_id: string;
  phone_number: string;
  bfam_id: string;
  role: string;
}

// A larger, varied name pool so a demo can show 50+ distinct players
// without every row looking like an obvious template repeat.
const FIRST_NAMES = [
  'Rohan',
  'Aditya',
  'Karan',
  'Vivaan',
  'Arjun',
  'Kabir',
  'Yash',
  'Dev',
  'Aarav',
  'Sai',
  'Reyansh',
  'Ishaan',
  'Vihaan',
  'Rudra',
  'Krish',
  'Aryan',
  'Dhruv',
  'Parth',
  'Neil',
  'Om',
  'Harsh',
  'Jay',
  'Kunal',
  'Manav',
  'Nikhil',
  'Pranav',
  'Rajat',
  'Sahil',
  'Tanmay',
  'Uday',
  'Varun',
  'Zeel',
  'Aditi',
  'Bhavya',
  'Chirag',
  'Darshan',
  'Esha',
  'Falguni',
  'Gaurav',
  'Hemal',
  'Ishan',
  'Jigar',
  'Kavya',
  'Lavanya',
  'Mihir',
  'Nirav',
  'Ojas',
  'Priyansh',
  'Raj',
  'Samir',
  'Tarun',
  'Utkarsh',
  'Vikram',
  'Yug',
  'Aayush',
  'Bhargav',
];
const LAST_NAMES = [
  'Mehta',
  'Shah',
  'Patel',
  'Joshi',
  'Desai',
  'Trivedi',
  'Rana',
  'Solanki',
  'Vora',
  'Thakkar',
  'Parekh',
  'Gandhi',
  'Modi',
  'Bhatt',
  'Pandya',
  'Rathod',
  'Chauhan',
  'Zaveri',
  'Doshi',
  'Kapadia',
];
const N_PLAYERS = 56;
const N_TEAMS = 12;

async function main() {
  await sequelize.authenticate();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ---- Users & players --------------------------------------------------
  const playerNames = Array.from(
    { length: N_PLAYERS },
    (_, i) =>
      `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length || i % LAST_NAMES.length]}`,
  );
  const playerUsers: SeedUser[] = playerNames.map((_, i) => ({
    user_id: randomUUID(),
    phone_number: `+9199${RUN_TAG}${String(i).padStart(2, '0')}`,
    bfam_id: `BFDEMO${RUN_TAG}${String(i).padStart(2, '0')}`,
    role: 'PLAYER',
  }));
  const ownerUser: SeedUser = {
    user_id: randomUUID(),
    phone_number: `+9198${RUN_TAG}01`,
    bfam_id: `BFDEMO${RUN_TAG}OW`,
    role: 'TURF_OWNER',
  };
  const staffUser: SeedUser = {
    user_id: randomUUID(),
    phone_number: `+9198${RUN_TAG}02`,
    bfam_id: `BFDEMO${RUN_TAG}ST`,
    role: 'TURF_STAFF',
  };

  const allUsers = [...playerUsers, ownerUser, staffUser];
  await insert(
    'users',
    allUsers.map((u, i) => ({
      user_id: u.user_id,
      phone_number: u.phone_number,
      email: `${u.role.toLowerCase()}${i}.${RUN_TAG}.demo@bfam.local`,
      password_hash: passwordHash,
      role: u.role,
      account_status: 'ACTIVE',
      phone_verified_at: now,
      profile_photo_url: null,
      city: 'Rajkot',
      preferred_language: 'en',
      bfam_id: u.bfam_id,
      google_id: null,
      apple_id: null,
      is_minor: false,
      last_login_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })),
  );

  const roles = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'];
  const players = playerUsers.map((u, i) => ({
    player_id: randomUUID(),
    user_id: u.user_id,
    bfam_id: u.bfam_id,
    full_name: playerNames[i],
    playing_role: roles[i % roles.length],
    batting_style: i % 3 === 0 ? 'LEFT_HANDED' : 'RIGHT_HANDED',
    bowling_style: i % 2 === 0 ? 'RIGHT_ARM_MEDIUM' : 'RIGHT_ARM_FAST',
    experience_level: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'][i % 3],
    skill_rating: 450 + ((i * 13) % 350),
    reliability_score: 80 + (i % 20),
    bio: `Demo player #${i + 1} — seeded for testing.`,
    date_of_birth: `199${i % 9}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
    favorite_cricketer_name: null,
    favorite_cricketer_external_id: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }));
  await insert('players', players);
  const playerIdByUserId = new Map(players.map((p) => [p.user_id, p.player_id]));

  // ---- Teams (via teamService — real captain/membership invariants) -----
  // N_TEAMS teams of varied size (4-8 members incl. captain), drawn
  // round-robin from the player pool so members overlap across teams the
  // way real players do (no exclusivity constraint on team membership).
  const TEAM_NAMES = [
    'Rajkot Royals',
    'Night Owls CC',
    'Turf Titans',
    'Boundary Breakers',
    'Kings XI Rajkot',
    'Yorker Yodhas',
    'Sixer Squad',
    'Midnight Strikers',
    'Chakra Cricketers',
    'Ring Road Raiders',
    'Green Park Gladiators',
    'Floodlight Falcons',
  ];
  const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
  const teams: Array<{ team_id: string; team_name: string }> = [];
  let poolCursor = 0;
  for (let t = 0; t < N_TEAMS; t++) {
    const size = 4 + (t % 5); // 4..8 members incl. captain
    const members: SeedUser[] = [];
    for (let m = 0; m < size; m++) {
      members.push(playerUsers[poolCursor % playerUsers.length]);
      poolCursor++;
    }
    const [captain, ...rest] = members;
    const team = await createTeam(captain.user_id, {
      team_name: TEAM_NAMES[t] ?? `Demo Team ${t + 1}`,
      description: `Seeded demo team #${t + 1}.`,
      skill_level: SKILL_LEVELS[t % SKILL_LEVELS.length],
      home_city: 'Rajkot',
      is_open_for_players: t % 3 !== 0,
    });
    for (const u of rest) {
      const inv = await inviteToTeam(
        team!.team_id,
        captain.user_id,
        playerIdByUserId.get(u.user_id)!,
      );
      await respondToInvitation(inv.invitation_id, u.user_id, true);
    }
    teams.push({ team_id: team!.team_id, team_name: team!.team_name });
  }
  const teamAlpha = { team_id: teams[0].team_id, team_name: teams[0].team_name };

  // ---- Turfs --------------------------------------------------------------
  const turfDefs = [
    { name: 'Green Park Box Cricket', lat: 22.3039, lng: 70.8022, rating: 4.5 },
    { name: 'Redline Turf Arena', lat: 22.2916, lng: 70.7933, rating: 4.2 },
    { name: 'Night Shot Cricket', lat: 22.3145, lng: 70.8101, rating: 4.7 },
  ];
  const turfs = turfDefs.map((t) => ({
    turf_id: randomUUID(),
    owner_id: ownerUser.user_id,
    turf_name: t.name,
    description: 'Covered box cricket turf with floodlights and a scoreboard.',
    address_line: `${t.name} Complex, Ring Road`,
    city: 'Rajkot',
    latitude: t.lat,
    longitude: t.lng,
    ball_types_supported: JSON.stringify(['TENNIS', 'HARD_TENNIS']),
    stadium_sound_enabled: true,
    turf_status: 'ACTIVE',
    average_rating: t.rating,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }));
  await insert('turfs', turfs);
  await insert(
    'turf_pricing',
    turfs.map((t) => ({
      pricing_id: randomUUID(),
      turf_id: t.turf_id,
      day_type: 'WEEKDAY',
      start_time: '06:00:00',
      end_time: '23:00:00',
      price_per_hour: 1000,
      currency: 'INR',
      effective_from: '2026-01-01',
      effective_to: null,
    })),
  );
  await insert(
    'turf_pricing',
    turfs.map((t) => ({
      pricing_id: randomUUID(),
      turf_id: t.turf_id,
      day_type: 'WEEKEND',
      start_time: '06:00:00',
      end_time: '23:00:00',
      price_per_hour: 1400,
      currency: 'INR',
      effective_from: '2026-01-01',
      effective_to: null,
    })),
  );
  await insert(
    'turf_images',
    turfs.map((t, i) => ({
      image_id: randomUUID(),
      turf_id: t.turf_id,
      image_url: `https://picsum.photos/seed/bfam-turf-${i}/800/500`,
      display_order: 1,
    })),
  );
  await insert(
    'turf_facilities',
    turfs.flatMap((t) =>
      ['FLOODLIGHTS', 'PARKING', 'WASHROOM', 'DRINKING_WATER'].map((f) => ({
        facility_id: randomUUID(),
        turf_id: t.turf_id,
        facility_name: f,
      })),
    ),
  );
  await insert(
    'turf_operating_hours',
    turfs.flatMap((t) =>
      [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        hours_id: randomUUID(),
        turf_id: t.turf_id,
        day_of_week: day,
        open_time: '06:00:00',
        close_time: '23:00:00',
      })),
    ),
  );
  await insert('turf_staff_assignments', [
    {
      assignment_id: randomUUID(),
      turf_id: turfs[0].turf_id,
      staff_user_id: staffUser.user_id,
      permissions: JSON.stringify({ check_in: true, scoring: true }),
      assigned_by: ownerUser.user_id,
      status: 'ACTIVE',
      created_at: now,
    },
  ]);

  // ---- Booking + Match A: roster still filling (OPEN) --------------------
  const bookingA = await createBooking({
    turfId: turfs[0].turf_id,
    bookedBy: playerUsers[0].user_id,
    bookingDate: daysFromNow(2),
    startTime: '18:00',
    durationMinutes: 60,
    paymentMode: 'SPLIT_PAYMENT',
  });
  await sequelize
    .getQueryInterface()
    .bulkUpdate('bookings', { booking_status: 'CONFIRMED' }, { booking_id: bookingA.booking_id });
  const matchA = await createMatch(playerUsers[0].user_id, {
    booking_id: bookingA.booking_id,
    match_name: 'Sunday Evening Bash',
    match_type: 'FRIENDS',
    ball_type: 'TENNIS',
    overs_per_innings: 8,
    scoring_mode: 'PLAYER_MANAGED',
  });
  const matchAInvitees = playerUsers.slice(1, 5);
  const matchAResponses: ('CONFIRMED' | 'MAYBE' | 'CANT_PLAY' | null)[] = [
    'CONFIRMED',
    'CONFIRMED',
    'MAYBE',
    null,
  ];
  for (let i = 0; i < matchAInvitees.length; i++) {
    const invite = await inviteToMatch(
      matchA.match_id,
      playerUsers[0].user_id,
      playerIdByUserId.get(matchAInvitees[i].user_id)!,
    );
    const response = matchAResponses[i];
    if (response)
      await respondToMatchInvitation(invite.invitation_id, matchAInvitees[i].user_id, response);
  }
  await createObligationsForBooking(bookingA.booking_id, playerUsers[0].user_id, [
    { playerId: playerIdByUserId.get(playerUsers[0].user_id)!, amount: 300 },
    { playerId: playerIdByUserId.get(playerUsers[1].user_id)!, amount: 300 },
    { playerId: null, amount: bookingA.booking_amount - 600 },
  ]);

  // ---- Booking + Match B: fully confirmed, intro not started -------------
  const bookingB = await createBooking({
    turfId: turfs[1].turf_id,
    bookedBy: playerUsers[5].user_id,
    bookingDate: daysFromNow(3),
    startTime: '19:00',
    durationMinutes: 120,
    paymentMode: 'CAPTAIN_PAYS',
  });
  await sequelize
    .getQueryInterface()
    .bulkUpdate('bookings', { booking_status: 'CONFIRMED' }, { booking_id: bookingB.booking_id });
  const matchB = await createMatch(playerUsers[5].user_id, {
    booking_id: bookingB.booking_id,
    match_name: 'Night Owls Practice Match',
    match_type: 'FAIR_PLAY',
    ball_type: 'HARD_TENNIS',
    overs_per_innings: 10,
    scoring_mode: 'TURF_STAFF_MANAGED',
    assigned_scorer_id: staffUser.user_id,
  });
  for (const u of [playerUsers[6], playerUsers[7], playerUsers[1], playerUsers[2]]) {
    const invite = await inviteToMatch(
      matchB.match_id,
      playerUsers[5].user_id,
      playerIdByUserId.get(u.user_id)!,
    );
    await respondToMatchInvitation(invite.invitation_id, u.user_id, 'CONFIRMED');
  }
  await createObligationsForBooking(bookingB.booking_id, playerUsers[5].user_id);

  // ---- Booking + Match D: further out, open, no invites yet --------------
  const bookingD = await createBooking({
    turfId: turfs[2].turf_id,
    bookedBy: playerUsers[3].user_id,
    bookingDate: daysFromNow(7),
    startTime: '20:00',
    durationMinutes: 60,
    paymentMode: 'UPI',
  });
  await sequelize
    .getQueryInterface()
    .bulkUpdate('bookings', { booking_status: 'CONFIRMED' }, { booking_id: bookingD.booking_id });
  await createMatch(playerUsers[3].user_id, {
    booking_id: bookingD.booking_id,
    match_name: 'Midweek Floodlit Friendly',
    match_type: 'FRIENDS',
    ball_type: 'TENNIS',
    overs_per_innings: 6,
    scoring_mode: 'PLAYER_MANAGED',
  });

  // ---- Booking + Match E: paused right at the toss step (Playing XI
  // confirmed both sides, toss not yet recorded) — for exercising/demoing
  // the toss step itself live rather than only its already-decided result.
  const bookingE = await createBooking({
    turfId: turfs[1].turf_id,
    bookedBy: playerUsers[8].user_id,
    bookingDate: daysFromNow(0),
    startTime: '21:00',
    durationMinutes: 60,
    paymentMode: 'CASH',
  });
  await sequelize
    .getQueryInterface()
    .bulkUpdate('bookings', { booking_status: 'CONFIRMED' }, { booking_id: bookingE.booking_id });
  const matchE = await createMatch(playerUsers[8].user_id, {
    booking_id: bookingE.booking_id,
    match_name: 'Ready for Toss',
    match_type: 'FRIENDS',
    ball_type: 'TENNIS',
    overs_per_innings: 6,
    scoring_mode: 'PLAYER_MANAGED',
  });
  const rosterE = playerUsers.slice(9, 15);
  for (const u of rosterE) {
    const invite = await inviteToMatch(
      matchE.match_id,
      playerUsers[8].user_id,
      playerIdByUserId.get(u.user_id)!,
    );
    await respondToMatchInvitation(invite.invitation_id, u.user_id, 'CONFIRMED');
  }
  await startIntro(matchE.match_id, playerUsers[8].user_id);
  await confirmPlayingXi(matchE.match_id, playerUsers[8].user_id, 'TEAM_A');
  await confirmPlayingXi(matchE.match_id, playerUsers[8].user_id, 'TEAM_B');

  // ---- Booking + Match F: LIVE right now — toss done, 2+ overs already
  // scored ball-by-ball, innings left IN_PROGRESS (never finalized) — for
  // testing the Live Score screen, Scorecard, and owner Digital Scoreboard
  // against a match that's actually mid-innings, not just 0/0 or completed.
  const bookingF = await createBooking({
    turfId: turfs[2].turf_id,
    bookedBy: playerUsers[15].user_id,
    bookingDate: daysFromNow(0),
    startTime: '22:00',
    durationMinutes: 60,
    paymentMode: 'CASH',
  });
  await sequelize
    .getQueryInterface()
    .bulkUpdate('bookings', { booking_status: 'CONFIRMED' }, { booking_id: bookingF.booking_id });
  const matchF = await createMatch(playerUsers[15].user_id, {
    booking_id: bookingF.booking_id,
    match_name: 'Live Now — Floodlit Friendly',
    match_type: 'FRIENDS',
    ball_type: 'TENNIS',
    overs_per_innings: 6,
    scoring_mode: 'PLAYER_MANAGED',
  });
  const rosterF = playerUsers.slice(16, 22);
  for (const u of rosterF) {
    const invite = await inviteToMatch(
      matchF.match_id,
      playerUsers[15].user_id,
      playerIdByUserId.get(u.user_id)!,
    );
    await respondToMatchInvitation(invite.invitation_id, u.user_id, 'CONFIRMED');
  }
  const introF = await startIntro(matchF.match_id, playerUsers[15].user_id);
  await confirmPlayingXi(matchF.match_id, playerUsers[15].user_id, 'TEAM_A');
  await confirmPlayingXi(matchF.match_id, playerUsers[15].user_id, 'TEAM_B');
  const teamAIdF = introF.matchTeams.find((t) => t.side_label === 'TEAM_A')!.match_team_id;
  const teamBIdF = introF.matchTeams.find((t) => t.side_label === 'TEAM_B')!.match_team_id;
  await recordToss(matchF.match_id, playerUsers[15].user_id, teamAIdF, 'BAT');
  await completeIntro(matchF.match_id, playerUsers[15].user_id);
  const inningsF = await startInnings(matchF.match_id, playerUsers[15].user_id, {
    innings_number: 1,
    batting_match_team_id: teamAIdF,
    bowling_match_team_id: teamBIdF,
  });

  // Organizer + first 3 of the 6-player roster bat; the other 3 bowl —
  // same split ratio as Match C below. 2 overs plus a partial 3rd (13
  // legal balls, one wide) so it reads as genuinely mid-over, not a round
  // number — a four, a six, and a wicket so the scorecard has real shape.
  const battingOrderF = [playerUsers[15], rosterF[0], rosterF[1], rosterF[2]];
  const bowlingOrderF = [rosterF[3], rosterF[4], rosterF[5]];
  const overFDeliveries = [
    { runs: 1 },
    { runs: 4 },
    { runs: 0 },
    { runs: 2 },
    { runs: 0, extra: 'WIDE' as const, extraRuns: 1 },
    { runs: 1 },
    { runs: 6 },
    { runs: 0 },
    { runs: 0, wicket: true },
    { runs: 1 },
    { runs: 4 },
    { runs: 2 },
    { runs: 1 },
    { runs: 0 },
  ];
  let strikerIdxF = 0;
  let bowlerIdxF = 0;
  for (let i = 0; i < overFDeliveries.length; i++) {
    const d = overFDeliveries[i];
    if (i > 0 && i % 6 === 0) bowlerIdxF = (bowlerIdxF + 1) % bowlingOrderF.length;
    const striker = battingOrderF[strikerIdxF % battingOrderF.length];
    const nonStriker = battingOrderF[(strikerIdxF + 1) % battingOrderF.length];
    const bowler = bowlingOrderF[bowlerIdxF];
    await recordBall(inningsF!.innings_id, playerUsers[15].user_id, {
      striker_player_id: playerIdByUserId.get(striker.user_id)!,
      non_striker_player_id: playerIdByUserId.get(nonStriker.user_id)!,
      bowler_player_id: playerIdByUserId.get(bowler.user_id)!,
      runs_scored: d.wicket ? 0 : d.runs,
      extra_type: d.extra ?? 'NONE',
      extra_runs: d.extraRuns ?? 0,
      is_wicket: Boolean(d.wicket),
      wicket_type: d.wicket ? 'BOWLED' : null,
      dismissed_player_id: d.wicket ? playerIdByUserId.get(striker.user_id)! : null,
    });
    if (d.wicket) strikerIdxF += 2;
    else if (d.runs % 2 === 1) strikerIdxF += 1;
  }

  // ---- Booking + Match C: fully completed with a real ball-by-ball ------
  const bookingC = await createBooking({
    turfId: turfs[0].turf_id,
    bookedBy: playerUsers[0].user_id,
    bookingDate: daysFromNow(-1),
    startTime: '17:00',
    durationMinutes: 60,
    paymentMode: 'CASH',
  });
  await sequelize
    .getQueryInterface()
    .bulkUpdate('bookings', { booking_status: 'CONFIRMED' }, { booking_id: bookingC.booking_id });
  const matchC = await createMatch(playerUsers[0].user_id, {
    booking_id: bookingC.booking_id,
    match_name: 'Royals vs Owls — Derby',
    match_type: 'TOURNAMENT',
    ball_type: 'TENNIS',
    overs_per_innings: 5,
    scoring_mode: 'PLAYER_MANAGED',
  });
  const rosterC = [
    playerUsers[1],
    playerUsers[2],
    playerUsers[3],
    playerUsers[5],
    playerUsers[6],
    playerUsers[7],
  ];
  for (const u of rosterC) {
    const invite = await inviteToMatch(
      matchC.match_id,
      playerUsers[0].user_id,
      playerIdByUserId.get(u.user_id)!,
    );
    await respondToMatchInvitation(invite.invitation_id, u.user_id, 'CONFIRMED');
  }

  const introC = await startIntro(matchC.match_id, playerUsers[0].user_id);
  await confirmPlayingXi(matchC.match_id, playerUsers[0].user_id, 'TEAM_A');
  await confirmPlayingXi(matchC.match_id, playerUsers[0].user_id, 'TEAM_B');
  const teamAId = introC.matchTeams.find((t) => t.side_label === 'TEAM_A')!.match_team_id;
  const teamBId = introC.matchTeams.find((t) => t.side_label === 'TEAM_B')!.match_team_id;
  await recordToss(matchC.match_id, playerUsers[0].user_id, teamAId, 'BAT');
  await completeIntro(matchC.match_id, playerUsers[0].user_id);

  const battingOrder1 = [playerUsers[0], playerUsers[1], playerUsers[2], playerUsers[3]];
  const bowlingOrder1 = [playerUsers[5], playerUsers[6], playerUsers[7]];
  const innings1 = await startInnings(matchC.match_id, playerUsers[0].user_id, {
    innings_number: 1,
    batting_match_team_id: teamAId,
    bowling_match_team_id: teamBId,
  });

  // A plausible (not literally realistic every-ball) 5-over innings: mostly
  // 0/1/2 with a few boundaries, one wide, one wicket, so the scorecard
  // and audio-trigger paths all have real data to show.
  const over1Deliveries = [
    { runs: 1 },
    { runs: 4 },
    { runs: 0 },
    { runs: 0, extra: 'WIDE' as const, extraRuns: 1 },
    { runs: 2 },
    { runs: 6 },
    { runs: 0 },
    { runs: 1 },
    { runs: 0, wicket: true },
    { runs: 1 },
    { runs: 4 },
    { runs: 2 },
    { runs: 0 },
    { runs: 1 },
    { runs: 1 },
    { runs: 6 },
    { runs: 0 },
    { runs: 2 },
    { runs: 1 },
    { runs: 0 },
    { runs: 4 },
    { runs: 1 },
    { runs: 0, wicket: true },
    { runs: 1 },
    { runs: 2 },
    { runs: 1 },
    { runs: 0 },
    { runs: 6 },
    { runs: 1 },
    { runs: 1 },
  ];
  let strikerIdx = 0;
  let bowlerIdx = 0;
  for (let i = 0; i < over1Deliveries.length; i++) {
    const d = over1Deliveries[i];
    if (i > 0 && i % 6 === 0) bowlerIdx = (bowlerIdx + 1) % bowlingOrder1.length;
    const striker = battingOrder1[strikerIdx % battingOrder1.length];
    const nonStriker = battingOrder1[(strikerIdx + 1) % battingOrder1.length];
    const bowler = bowlingOrder1[bowlerIdx];
    await recordBall(innings1!.innings_id, playerUsers[0].user_id, {
      striker_player_id: playerIdByUserId.get(striker.user_id)!,
      non_striker_player_id: playerIdByUserId.get(nonStriker.user_id)!,
      bowler_player_id: playerIdByUserId.get(bowler.user_id)!,
      runs_scored: d.wicket ? 0 : d.runs,
      extra_type: d.extra ?? 'NONE',
      extra_runs: d.extraRuns ?? 0,
      is_wicket: Boolean(d.wicket),
      wicket_type: d.wicket ? 'BOWLED' : null,
      dismissed_player_id: d.wicket ? playerIdByUserId.get(striker.user_id)! : null,
    });
    if (d.wicket)
      strikerIdx += 2; // next batsman in
    else if (d.runs % 2 === 1) strikerIdx += 1; // strike rotates on odd runs
  }

  const innings1Final = await sequelize.query<{ total_runs: number }>(
    'SELECT total_runs FROM innings WHERE innings_id = :id',
    { replacements: { id: innings1!.innings_id }, type: QueryTypes.SELECT },
  );
  const target = (innings1Final[0]?.total_runs ?? 30) + 1;

  const innings2 = await startInnings(matchC.match_id, playerUsers[0].user_id, {
    innings_number: 2,
    batting_match_team_id: teamBId,
    bowling_match_team_id: teamAId,
    target_runs: target,
  });
  const battingOrder2 = bowlingOrder1;
  const bowlingOrder2 = battingOrder1;
  const over2Deliveries = [
    { runs: 2 },
    { runs: 1 },
    { runs: 4 },
    { runs: 0 },
    { runs: 1 },
    { runs: 0 },
    { runs: 6 },
    { runs: 1 },
    { runs: 0, wicket: true },
    { runs: 4 },
    { runs: 1 },
    { runs: 2 },
    { runs: 1 },
    { runs: 1 },
    { runs: 0 },
    { runs: 4 },
    { runs: 6 },
    { runs: 1 },
    { runs: 0 },
    { runs: 1 },
    { runs: 2 },
    { runs: 0, wicket: true },
    { runs: 1 },
    { runs: 1 },
  ];
  strikerIdx = 0;
  bowlerIdx = 0;
  for (let i = 0; i < over2Deliveries.length; i++) {
    const d = over2Deliveries[i];
    if (i > 0 && i % 6 === 0) bowlerIdx = (bowlerIdx + 1) % bowlingOrder2.length;
    const striker = battingOrder2[strikerIdx % battingOrder2.length];
    const nonStriker = battingOrder2[(strikerIdx + 1) % battingOrder2.length];
    const bowler = bowlingOrder2[bowlerIdx];
    await recordBall(innings2!.innings_id, playerUsers[0].user_id, {
      striker_player_id: playerIdByUserId.get(striker.user_id)!,
      non_striker_player_id: playerIdByUserId.get(nonStriker.user_id)!,
      bowler_player_id: playerIdByUserId.get(bowler.user_id)!,
      runs_scored: d.wicket ? 0 : d.runs,
      extra_type: 'NONE',
      extra_runs: 0,
      is_wicket: Boolean(d.wicket),
      wicket_type: d.wicket ? 'CAUGHT' : null,
      dismissed_player_id: d.wicket ? playerIdByUserId.get(striker.user_id)! : null,
      fielder_player_id: d.wicket ? playerIdByUserId.get(bowler.user_id)! : null,
    });
    if (d.wicket) strikerIdx += 2;
    else if (d.runs % 2 === 1) strikerIdx += 1;
  }

  await finalizeMatch(matchC.match_id, playerUsers[0].user_id, {
    result_type: 'WIN',
    winning_match_team_id: teamAId,
    winning_margin: `${Math.max(1, target - 1)} runs (approx)`,
    player_of_the_match_id: playerIdByUserId.get(playerUsers[0].user_id)!,
  });
  await createObligationsForBooking(bookingC.booking_id, playerUsers[0].user_id);
  const obligationsC = await sequelize.query<{ obligation_id: string }>(
    'SELECT obligation_id FROM payment_obligations WHERE booking_id = :id',
    { replacements: { id: bookingC.booking_id }, type: QueryTypes.SELECT },
  );
  await recordCashPayment(
    obligationsC.map((o) => o.obligation_id),
    playerUsers[0].user_id,
    playerUsers[0].user_id,
    'Collected at turf',
  );

  // ---- Notifications -------------------------------------------------------
  await insert('notifications', [
    {
      notification_id: randomUUID(),
      user_id: playerUsers[0].user_id,
      notification_type: 'MATCH_REMINDER',
      title: 'Match reminder',
      body: `${matchA.match_name} starts in 24 hours.`,
      related_entity_type: 'match',
      related_entity_id: matchA.match_id,
      delivery_channel: 'PUSH',
      delivery_status: 'DELIVERED',
      created_at: now,
      read_at: null,
    },
    {
      notification_id: randomUUID(),
      user_id: playerUsers[1].user_id,
      notification_type: 'TEAM_INVITE',
      title: 'Team invite',
      body: 'You were invited to join Rajkot Royals.',
      related_entity_type: 'team',
      related_entity_id: teamAlpha.team_id,
      delivery_channel: 'IN_APP',
      delivery_status: 'READ',
      created_at: now,
      read_at: now,
    },
  ]);

  console.log('\n=== BFAM demo data seeded ===');
  console.log(`Shared password for every seeded account: ${PASSWORD}\n`);
  console.log('Log in with any phone number below:');
  for (const u of playerUsers) console.log(`  PLAYER        ${u.phone_number}`);
  console.log(`  TURF_OWNER    ${ownerUser.phone_number}`);
  console.log(`  TURF_STAFF    ${staffUser.phone_number}`);
  console.log('\nWhat you can see:');
  console.log(
    `  - 3 turfs (owner: ${ownerUser.phone_number}), each with pricing/images/facilities`,
  );
  console.log(
    `  - ${N_TEAMS} teams of 4-8 players each, drawn round-robin from the ${N_PLAYERS} seeded players`,
  );
  console.log(
    `  - Match A "${matchA.match_name}": roster still filling (2 confirmed, 1 maybe, 1 pending, 1 never invited)`,
  );
  console.log(
    `  - Match B "${matchB.match_name}": fully confirmed roster, turf-staff-managed scoring, intro not started`,
  );
  console.log(
    `  - Match E "${matchE.match_name}": Playing XI confirmed both sides, toss NOT recorded yet`,
  );
  console.log(
    `  - Match F "${matchF.match_name}": LIVE — innings 1 in progress, 2+ overs already scored ` +
      '(open Live Score / Scorecard, or keep scoring it yourself in the app)',
  );
  console.log(
    '  - Match C "Royals vs Owls — Derby": COMPLETED, 2 full innings scored ball-by-ball, result finalized with POTM',
  );
  console.log('  - Match D "Midweek Floodlit Friendly": booked a week out, no invites yet');
  console.log(
    "\nTo wipe this data later, filter by bfam_id LIKE 'BFDEMO%' / phone_number LIKE '+9199" +
      RUN_TAG +
      "%' or '+9198" +
      RUN_TAG +
      "%'.",
  );

  await sequelize.close();
}

main().catch(async (error) => {
  console.error('Demo seed failed:', error);
  await sequelize.close();
  process.exit(1);
});
