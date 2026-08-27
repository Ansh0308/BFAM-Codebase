import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { sequelize } from '../config/sequelize';
import { USER_ROLES } from '../domain/constants';

const now = new Date();
const password = 'BfamPhase1!234';

async function insert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  await sequelize.getQueryInterface().bulkInsert(table, rows);
}

async function main() {
  await sequelize.authenticate();

  const passwordHash = await bcrypt.hash(password, 10);
  const users = USER_ROLES.map((role, index) => ({
    user_id: randomUUID(),
    phone_number: `+9198765432${index}`,
    email: `${role.toLowerCase()}@bfam.local`,
    password_hash: passwordHash,
    role,
    account_status: 'ACTIVE',
    phone_verified_at: now,
    profile_photo_url: null,
    city: role === 'ADMIN' ? 'Ahmedabad' : 'Rajkot',
    preferred_language: 'en',
    bfam_id: `BF${1000 + index}`,
    google_id: null,
    apple_id: null,
    is_minor: false,
    last_login_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }));

  const [playerUser, ownerUser, staffUser, adminUser] = users;
  const extraPlayerUsers = [0, 1].map((index) => ({
    user_id: randomUUID(),
    phone_number: `+9198765433${index}`,
    email: `sample.player${index + 2}@bfam.local`,
    password_hash: passwordHash,
    role: 'PLAYER',
    account_status: 'ACTIVE',
    phone_verified_at: now,
    profile_photo_url: null,
    city: 'Rajkot',
    preferred_language: 'en',
    bfam_id: `BF${1004 + index}`,
    google_id: null,
    apple_id: null,
    is_minor: false,
    last_login_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }));
  const allUsers = [...users, ...extraPlayerUsers];

  const playerProfiles = [playerUser, ...extraPlayerUsers].map((user, index) => ({
    player_id: randomUUID(),
    user_id: user.user_id,
    bfam_id: user.bfam_id,
    playing_role: index === 0 ? 'ALL_ROUNDER' : 'BATTER',
    batting_style: 'RIGHT_HANDED',
    bowling_style: index === 1 ? 'RIGHT_ARM_FAST' : 'RIGHT_ARM_MEDIUM',
    experience_level: index === 2 ? 'BEGINNER' : 'INTERMEDIATE',
    skill_rating: 650 + index * 25,
    reliability_score: 94.5,
    bio: index === 0 ? 'Weekend box-cricket regular.' : null,
    date_of_birth: '1998-04-12',
    favorite_cricketer_name: index === 0 ? 'MS Dhoni' : 'Virat Kohli',
    favorite_cricketer_external_id: index === 0 ? 'cricket-104' : 'cricket-18',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }));

  const team = {
    team_id: randomUUID(),
    team_name: 'Rajkot Strikers',
    team_logo_url: null,
    description: 'Weekend evening regulars.',
    skill_level: 'MIXED',
    home_city: 'Rajkot',
    is_open_for_players: true,
    team_status: 'ACTIVE',
    created_by: playerUser.user_id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  const turfs = ['Green Park Box Cricket', 'Redline Turf Arena', 'Night Shot Cricket'].map(
    (name, index) => ({
      turf_id: randomUUID(),
      owner_id: ownerUser.user_id,
      turf_name: name,
      description: 'Covered box cricket turf with lights.',
      address_line: `Ring Road Plot ${index + 1}`,
      city: 'Rajkot',
      latitude: 22.303894 + index / 1000,
      longitude: 70.802162 + index / 1000,
      ball_types_supported: JSON.stringify(['TENNIS', 'HARD_TENNIS']),
      stadium_sound_enabled: true,
      turf_status: 'ACTIVE',
      average_rating: 4.3,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }),
  );

  const booking = {
    booking_id: randomUUID(),
    turf_id: turfs[0].turf_id,
    booked_by: playerUser.user_id,
    booking_date: '2026-08-28',
    start_time: '19:00:00',
    end_time: '21:00:00',
    duration_minutes: 120,
    booking_amount: 2400,
    booking_status: 'PENDING',
    payment_mode: 'SPLIT_PAYMENT',
    cancellation_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: now,
    updated_at: now,
  };

  const match = {
    match_id: randomUUID(),
    booking_id: booking.booking_id,
    match_name: 'Sunday Evening Bash',
    organizer_id: playerUser.user_id,
    match_type: 'FRIENDS',
    ball_type: 'TENNIS',
    overs_per_innings: 8,
    scoring_mode: 'PLAYER_MANAGED',
    assigned_scorer_id: staffUser.user_id,
    match_status: 'PENDING',
    visibility: 'PRIVATE',
    scheduled_start_time: new Date('2026-08-28T13:30:00.000Z'),
    actual_start_time: null,
    actual_end_time: null,
    created_at: now,
    updated_at: now,
  };

  await sequelize.transaction(async () => {
    await insert('users', allUsers);
    await insert('players', playerProfiles);
    await insert('teams', [team]);
    await insert(
      'team_members',
      playerProfiles.map((player, index) => ({
        team_member_id: randomUUID(),
        team_id: team.team_id,
        player_id: player.player_id,
        role_in_team: index === 0 ? 'CAPTAIN' : 'MEMBER',
        membership_status: 'ACTIVE',
        joined_at: now,
        left_at: null,
      })),
    );
    await insert('turfs', turfs);
    await insert(
      'turf_pricing',
      turfs.map((turf) => ({
        pricing_id: randomUUID(),
        turf_id: turf.turf_id,
        day_type: 'WEEKEND',
        start_time: '18:00:00',
        end_time: '22:00:00',
        price_per_hour: 1200,
        currency: 'INR',
        effective_from: '2026-08-01',
        effective_to: null,
      })),
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
    await insert(
      'turf_images',
      turfs.map((turf, index) => ({
        image_id: randomUUID(),
        turf_id: turf.turf_id,
        image_url: `https://cdn.bfam.app/turfs/${index + 1}.jpg`,
        display_order: 1,
      })),
    );
    await insert(
      'turf_facilities',
      turfs.map((turf) => ({
        facility_id: randomUUID(),
        turf_id: turf.turf_id,
        facility_name: 'FLOODLIGHTS',
      })),
    );
    await insert(
      'turf_operating_hours',
      turfs.map((turf) => ({
        hours_id: randomUUID(),
        turf_id: turf.turf_id,
        day_of_week: 6,
        open_time: '06:00:00',
        close_time: '23:00:00',
      })),
    );
    await insert('bookings', [booking]);
    await insert('matches', [match]);
    await insert('payment_obligations', [
      {
        obligation_id: randomUUID(),
        booking_id: booking.booking_id,
        player_id: null,
        amount_due: 2400,
        due_status: 'PENDING',
        created_at: now,
        updated_at: now,
      },
    ]);
    await insert('match_intro', [
      {
        intro_id: randomUUID(),
        match_id: match.match_id,
        countdown_enabled: true,
        background_music_enabled: true,
        playing_xi_confirmed_team_a: false,
        playing_xi_confirmed_team_b: false,
        intro_played_at: null,
      },
    ]);
    await insert('notifications', [
      {
        notification_id: randomUUID(),
        user_id: playerUser.user_id,
        notification_type: 'MATCH_REMINDER',
        title: 'Match pending confirmation',
        body: 'Your match at Green Park is waiting for players.',
        related_entity_type: 'match',
        related_entity_id: match.match_id,
        delivery_channel: 'PUSH',
        delivery_status: 'PENDING',
        created_at: now,
        read_at: null,
      },
    ]);
    await insert('audit_logs', [
      {
        log_id: randomUUID(),
        actor_user_id: adminUser.user_id,
        actor_role: 'ADMIN',
        action: 'PHASE1_SEED',
        resource_type: 'match',
        resource_id: match.match_id,
        before_data: null,
        after_data: JSON.stringify({ seeded: true }),
        ip_address: null,
        request_id: null,
        created_at: now,
      },
    ]);
  });

  console.log(`Seeded Phase 1 data. Test password for seeded users: ${password}`);
  await sequelize.close();
}

main().catch(async (error) => {
  console.error(error);
  await sequelize.close();
  process.exit(1);
});
