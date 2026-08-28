import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import {
  ACCOUNT_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  AUDIO_TRIGGERS,
  BALL_TYPES,
  BATTING_STYLES,
  BLOCK_REASONS,
  BOOKING_STATUSES,
  DAY_TYPES,
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  DUE_STATUSES,
  EXPERIENCE_LEVELS,
  EXTRA_TYPES,
  INNINGS_STATUSES,
  INVITATION_STATUSES,
  MATCH_STATUSES,
  MATCH_TYPES,
  MATCH_VISIBILITIES,
  MEMBERSHIP_STATUSES,
  PARTICIPANT_ROLES,
  PAYMENT_METHODS,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  PLAYING_ROLES,
  RATING_DIMENSIONS,
  RATING_EVENT_TYPES,
  REFUND_STATUSES,
  REPLACEMENT_STATUSES,
  RESULT_TYPES,
  SCORING_MODES,
  SIDE_LABELS,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  TEAM_MEMBER_ROLES,
  TEAM_SKILL_LEVELS,
  TEAM_STATUSES,
  TURF_STATUSES,
  USER_ROLES,
  WICKET_TYPES,
  NOTIFICATION_TYPES,
} from '../domain/constants';

const uuidPk = () => ({
  type: DataTypes.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: DataTypes.UUIDV4,
});
const uuid = (references?: { model: string; key: string }, allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references,
  onUpdate: 'CASCADE',
  onDelete: allowNull ? 'SET NULL' : 'RESTRICT',
});
const ts = (allowNull = false) => ({ type: DataTypes.DATE, allowNull });
const enumCol = (values: readonly string[], allowNull = false, defaultValue?: string) => ({
  type: DataTypes.ENUM(...values),
  allowNull,
  ...(defaultValue ? { defaultValue } : {}),
});

module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('users', {
      user_id: uuidPk(),
      phone_number: { type: DataTypes.STRING(15), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(255), allowNull: true, unique: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      role: enumCol(USER_ROLES, false),
      account_status: enumCol(ACCOUNT_STATUSES, false, 'ACTIVE'),
      phone_verified_at: ts(true),
      profile_photo_url: { type: DataTypes.STRING(500), allowNull: true },
      city: { type: DataTypes.STRING(100), allowNull: true },
      preferred_language: { type: DataTypes.STRING(10), allowNull: true },
      bfam_id: { type: DataTypes.STRING(15), allowNull: false, unique: true },
      google_id: { type: DataTypes.STRING(255), allowNull: true, unique: true },
      apple_id: { type: DataTypes.STRING(255), allowNull: true, unique: true },
      is_minor: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      last_login_at: ts(true),
      created_at: ts(),
      updated_at: ts(),
      deleted_at: ts(true),
    });

    await queryInterface.createTable('players', {
      player_id: uuidPk(),
      user_id: uuid({ model: 'users', key: 'user_id' }),
      bfam_id: {
        type: DataTypes.STRING(15),
        allowNull: false,
        references: { model: 'users', key: 'bfam_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      playing_role: enumCol(PLAYING_ROLES, true),
      batting_style: enumCol(BATTING_STYLES, true),
      bowling_style: { type: DataTypes.STRING(30), allowNull: true },
      experience_level: enumCol(EXPERIENCE_LEVELS, false, 'BEGINNER'),
      skill_rating: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 500 },
      reliability_score: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 100 },
      bio: { type: DataTypes.TEXT, allowNull: true },
      date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
      favorite_cricketer_name: { type: DataTypes.STRING(100), allowNull: true },
      favorite_cricketer_external_id: { type: DataTypes.STRING(50), allowNull: true },
      created_at: ts(),
      updated_at: ts(),
      deleted_at: ts(true),
    });
    await queryInterface.addConstraint('players', {
      fields: ['user_id'],
      type: 'unique',
      name: 'uk_players_user_id',
    });
    await queryInterface.addConstraint('players', {
      fields: ['bfam_id'],
      type: 'unique',
      name: 'uk_players_bfam_id',
    });

    await queryInterface.createTable('teams', {
      team_id: uuidPk(),
      team_name: { type: DataTypes.STRING(100), allowNull: false },
      team_logo_url: { type: DataTypes.STRING(500), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      skill_level: enumCol(TEAM_SKILL_LEVELS, true),
      home_city: { type: DataTypes.STRING(100), allowNull: true },
      is_open_for_players: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      team_status: enumCol(TEAM_STATUSES, false, 'ACTIVE'),
      created_by: uuid({ model: 'users', key: 'user_id' }),
      created_at: ts(),
      updated_at: ts(),
      deleted_at: ts(true),
    });

    await queryInterface.createTable('team_members', {
      team_member_id: uuidPk(),
      team_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'teams', key: 'team_id' },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT',
      },
      player_id: uuid({ model: 'players', key: 'player_id' }),
      role_in_team: enumCol(TEAM_MEMBER_ROLES, false),
      membership_status: enumCol(MEMBERSHIP_STATUSES, false, 'ACTIVE'),
      joined_at: ts(),
      left_at: ts(true),
    });
    await queryInterface.addConstraint('team_members', {
      fields: ['team_id', 'player_id'],
      type: 'unique',
      name: 'uk_team_members_team_player',
    });
    await queryInterface.sequelize.query(
      "ALTER TABLE team_members ADD COLUMN active_captain_team_id CHAR(36) BINARY GENERATED ALWAYS AS (CASE WHEN role_in_team = 'CAPTAIN' AND membership_status = 'ACTIVE' THEN team_id ELSE NULL END) STORED",
    );
    await queryInterface.addIndex('team_members', ['active_captain_team_id'], {
      unique: true,
      name: 'uk_one_active_captain_per_team',
    });

    await queryInterface.createTable('team_invitations', {
      invitation_id: uuidPk(),
      team_id: uuid({ model: 'teams', key: 'team_id' }),
      invited_player_id: uuid({ model: 'players', key: 'player_id' }),
      invited_by: uuid({ model: 'users', key: 'user_id' }),
      status: enumCol(INVITATION_STATUSES, false, 'PENDING'),
      created_at: ts(),
      responded_at: ts(true),
      expires_at: ts(true),
    });

    await queryInterface.createTable('team_join_requests', {
      request_id: uuidPk(),
      team_id: uuid({ model: 'teams', key: 'team_id' }),
      player_id: uuid({ model: 'players', key: 'player_id' }),
      status: enumCol(INVITATION_STATUSES, false, 'PENDING'),
      requested_at: ts(),
      responded_by: uuid({ model: 'users', key: 'user_id' }, true),
    });

    await queryInterface.createTable('turfs', {
      turf_id: uuidPk(),
      owner_id: uuid({ model: 'users', key: 'user_id' }),
      turf_name: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      address_line: { type: DataTypes.STRING(255), allowNull: false },
      city: { type: DataTypes.STRING(100), allowNull: false },
      latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
      longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
      ball_types_supported: { type: DataTypes.JSON, allowNull: true },
      stadium_sound_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      turf_status: enumCol(TURF_STATUSES, false, 'ACTIVE'),
      average_rating: { type: DataTypes.DECIMAL(3, 2), allowNull: true },
      created_at: ts(),
      updated_at: ts(),
      deleted_at: ts(true),
    });

    await queryInterface.createTable('turf_pricing', {
      pricing_id: uuidPk(),
      turf_id: uuid({ model: 'turfs', key: 'turf_id' }),
      day_type: enumCol(DAY_TYPES, false),
      start_time: { type: DataTypes.TIME, allowNull: false },
      end_time: { type: DataTypes.TIME, allowNull: false },
      price_per_hour: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'INR' },
      effective_from: { type: DataTypes.DATEONLY, allowNull: false },
      effective_to: { type: DataTypes.DATEONLY, allowNull: true },
    });

    await queryInterface.createTable('turf_staff_assignments', {
      assignment_id: uuidPk(),
      turf_id: uuid({ model: 'turfs', key: 'turf_id' }),
      staff_user_id: uuid({ model: 'users', key: 'user_id' }),
      permissions: { type: DataTypes.JSON, allowNull: false },
      assigned_by: uuid({ model: 'users', key: 'user_id' }),
      status: enumCol(ASSIGNMENT_STATUSES, false, 'ACTIVE'),
      created_at: ts(),
    });

    await queryInterface.createTable('turf_availability_blocks', {
      block_id: uuidPk(),
      turf_id: uuid({ model: 'turfs', key: 'turf_id' }),
      start_datetime: ts(),
      end_datetime: ts(),
      reason: enumCol(BLOCK_REASONS, false),
      created_by: uuid({ model: 'users', key: 'user_id' }),
      created_at: ts(),
    });

    await queryInterface.createTable('turf_images', {
      image_id: uuidPk(),
      turf_id: uuid({ model: 'turfs', key: 'turf_id' }),
      image_url: { type: DataTypes.STRING(500), allowNull: false },
      display_order: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    });
    await queryInterface.createTable('turf_facilities', {
      facility_id: uuidPk(),
      turf_id: uuid({ model: 'turfs', key: 'turf_id' }),
      facility_name: { type: DataTypes.STRING(50), allowNull: false },
    });
    await queryInterface.createTable('turf_operating_hours', {
      hours_id: uuidPk(),
      turf_id: uuid({ model: 'turfs', key: 'turf_id' }),
      day_of_week: { type: DataTypes.SMALLINT, allowNull: false },
      open_time: { type: DataTypes.TIME, allowNull: false },
      close_time: { type: DataTypes.TIME, allowNull: false },
    });

    await queryInterface.createTable('bookings', {
      booking_id: uuidPk(),
      turf_id: uuid({ model: 'turfs', key: 'turf_id' }),
      booked_by: uuid({ model: 'users', key: 'user_id' }),
      booking_date: { type: DataTypes.DATEONLY, allowNull: false },
      start_time: { type: DataTypes.TIME, allowNull: false },
      end_time: { type: DataTypes.TIME, allowNull: false },
      duration_minutes: { type: DataTypes.SMALLINT, allowNull: false },
      booking_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      booking_status: enumCol(BOOKING_STATUSES, false, 'PENDING'),
      payment_mode: enumCol(PAYMENT_MODES, false),
      cancellation_reason: { type: DataTypes.STRING(255), allowNull: true },
      cancelled_at: ts(true),
      cancelled_by: uuid({ model: 'users', key: 'user_id' }, true),
      created_at: ts(),
      updated_at: ts(),
    });
    // Composite unique constraint (turf_id, booking_date, start_time) applies
    // only while booking_status IN ('PENDING','CONFIRMED') — the no-double-
    // booking guarantee. Same idea as the one-active-captain-per-team pattern
    // above (a generated column that is NULL unless the condition holds, with
    // a unique index on it), but VIRTUAL rather than STORED: MySQL 8.0's
    // ALGORITHM=INPLACE table rebuild for a STORED generated column fails
    // with "Cannot add foreign key constraint" (errno 150) on `bookings`
    // because it has multiple FK constraints referencing the same parent
    // table (`users`, via booked_by and cancelled_by) — reproduced directly
    // against MySQL 8.0.40. VIRTUAL generated columns don't require that
    // rebuild and are fully indexable, so they sidestep the bug.
    await queryInterface.sequelize.query(
      "ALTER TABLE bookings ADD COLUMN active_booking_slot_key VARCHAR(191) GENERATED ALWAYS AS (CASE WHEN booking_status IN ('PENDING','CONFIRMED') THEN CONCAT(turf_id, ':', booking_date, ':', start_time) ELSE NULL END) VIRTUAL",
    );
    await queryInterface.addIndex('bookings', ['active_booking_slot_key'], {
      unique: true,
      name: 'uk_active_booking_slot',
    });

    await queryInterface.createTable('matches', {
      match_id: uuidPk(),
      booking_id: uuid({ model: 'bookings', key: 'booking_id' }),
      match_name: { type: DataTypes.STRING(150), allowNull: true },
      organizer_id: uuid({ model: 'users', key: 'user_id' }),
      match_type: enumCol(MATCH_TYPES, false),
      ball_type: enumCol(BALL_TYPES, false),
      overs_per_innings: { type: DataTypes.SMALLINT, allowNull: false },
      scoring_mode: enumCol(SCORING_MODES, false),
      assigned_scorer_id: uuid({ model: 'users', key: 'user_id' }, true),
      match_status: enumCol(MATCH_STATUSES, false, 'OPEN'),
      visibility: enumCol(MATCH_VISIBILITIES, false, 'PRIVATE'),
      scheduled_start_time: ts(),
      actual_start_time: ts(true),
      actual_end_time: ts(true),
      created_at: ts(),
      updated_at: ts(),
    });

    await queryInterface.createTable('match_teams', {
      match_team_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      team_id: uuid({ model: 'teams', key: 'team_id' }, true),
      side_label: enumCol(SIDE_LABELS, false),
      created_at: ts(),
    });
    await queryInterface.createTable('match_players', {
      match_player_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      player_id: uuid({ model: 'players', key: 'player_id' }),
      match_team_id: uuid({ model: 'match_teams', key: 'match_team_id' }, true),
      participant_role: enumCol(PARTICIPANT_ROLES, false, 'PLAYER'),
      invitation_status: enumCol(INVITATION_STATUSES, false, 'PENDING'),
      attendance_status: enumCol(ATTENDANCE_STATUSES, false, 'PENDING'),
      checked_in_at: ts(true),
      added_at: ts(),
    });
    await queryInterface.createTable('match_invitations', {
      invitation_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      invited_player_id: uuid({ model: 'players', key: 'player_id' }),
      invited_by: uuid({ model: 'users', key: 'user_id' }),
      status: enumCol(INVITATION_STATUSES, false, 'PENDING'),
      sent_at: ts(),
      responded_at: ts(true),
      expires_at: ts(true),
    });
    await queryInterface.createTable('player_replacements', {
      replacement_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      vacating_player_id: uuid({ model: 'players', key: 'player_id' }),
      replacement_player_id: uuid({ model: 'players', key: 'player_id' }, true),
      initiated_by: uuid({ model: 'users', key: 'user_id' }),
      status: enumCol(REPLACEMENT_STATUSES, false, 'OPEN'),
      created_at: ts(),
      resolved_at: ts(true),
    });

    await queryInterface.createTable('payment_obligations', {
      obligation_id: uuidPk(),
      booking_id: uuid({ model: 'bookings', key: 'booking_id' }),
      player_id: uuid({ model: 'players', key: 'player_id' }, true),
      amount_due: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      due_status: enumCol(DUE_STATUSES, false, 'PENDING'),
      created_at: ts(),
      updated_at: ts(),
    });
    await queryInterface.createTable('payments', {
      payment_id: uuidPk(),
      payer_id: uuid({ model: 'users', key: 'user_id' }),
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'INR' },
      payment_method: enumCol(PAYMENT_METHODS, false),
      gateway: { type: DataTypes.STRING(30), allowNull: false },
      gateway_order_id: { type: DataTypes.STRING(100), allowNull: false },
      gateway_payment_id: { type: DataTypes.STRING(100), allowNull: true },
      collected_by: uuid({ model: 'users', key: 'user_id' }, true),
      cash_reference: { type: DataTypes.STRING(100), allowNull: true },
      payment_status: enumCol(PAYMENT_STATUSES, false, 'PENDING'),
      initiated_at: ts(),
      completed_at: ts(true),
    });
    await queryInterface.createTable('payment_allocations', {
      allocation_id: uuidPk(),
      payment_id: uuid({ model: 'payments', key: 'payment_id' }),
      obligation_id: uuid({ model: 'payment_obligations', key: 'obligation_id' }),
      allocated_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      created_at: ts(),
    });
    await queryInterface.createTable('refunds', {
      refund_id: uuidPk(),
      payment_id: uuid({ model: 'payments', key: 'payment_id' }),
      refund_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      reason: { type: DataTypes.STRING(255), allowNull: false },
      refund_status: enumCol(REFUND_STATUSES, false, 'PENDING'),
      gateway_refund_id: { type: DataTypes.STRING(100), allowNull: true },
      initiated_by: uuid({ model: 'users', key: 'user_id' }),
      created_at: ts(),
      completed_at: ts(true),
    });
    await queryInterface.createTable('payment_events', {
      event_id: uuidPk(),
      payment_id: uuid({ model: 'payments', key: 'payment_id' }),
      event_type: { type: DataTypes.STRING(50), allowNull: false },
      raw_payload: { type: DataTypes.JSON, allowNull: false },
      received_at: ts(),
    });

    await queryInterface.createTable('innings', {
      innings_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      innings_number: { type: DataTypes.SMALLINT, allowNull: false },
      batting_match_team_id: uuid({ model: 'match_teams', key: 'match_team_id' }),
      bowling_match_team_id: uuid({ model: 'match_teams', key: 'match_team_id' }),
      total_runs: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      total_wickets: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      overs_completed: { type: DataTypes.DECIMAL(4, 1), allowNull: false, defaultValue: 0 },
      innings_status: enumCol(INNINGS_STATUSES, false, 'NOT_STARTED'),
      target_runs: { type: DataTypes.INTEGER, allowNull: true },
      created_at: ts(),
      updated_at: ts(),
    });
    await queryInterface.createTable('score_events', {
      score_event_id: uuidPk(),
      innings_id: uuid({ model: 'innings', key: 'innings_id' }),
      over_number: { type: DataTypes.SMALLINT, allowNull: false },
      ball_number_in_over: { type: DataTypes.SMALLINT, allowNull: false },
      sequence_number: { type: DataTypes.INTEGER, allowNull: false },
      striker_player_id: uuid({ model: 'players', key: 'player_id' }),
      non_striker_player_id: uuid({ model: 'players', key: 'player_id' }, true),
      bowler_player_id: uuid({ model: 'players', key: 'player_id' }),
      runs_scored: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      extra_type: enumCol(EXTRA_TYPES, false, 'NONE'),
      extra_runs: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      is_wicket: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      wicket_type: enumCol(WICKET_TYPES, true),
      dismissed_player_id: uuid({ model: 'players', key: 'player_id' }, true),
      fielder_player_id: uuid({ model: 'players', key: 'player_id' }, true),
      audio_trigger: enumCol(AUDIO_TRIGGERS, false, 'NONE'),
      recorded_by: uuid({ model: 'users', key: 'user_id' }),
      recorded_at: ts(),
      is_corrected: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      correction_reference_id: uuid({ model: 'score_events', key: 'score_event_id' }, true),
    });
    await queryInterface.addConstraint('score_events', {
      fields: ['innings_id', 'sequence_number'],
      type: 'unique',
      name: 'uk_score_events_innings_sequence',
    });

    await queryInterface.createTable('match_results', {
      result_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      winning_match_team_id: uuid({ model: 'match_teams', key: 'match_team_id' }, true),
      result_type: enumCol(RESULT_TYPES, false),
      winning_margin: { type: DataTypes.STRING(50), allowNull: true },
      player_of_the_match_id: uuid({ model: 'players', key: 'player_id' }, true),
      finalized_at: ts(),
      finalized_by: uuid({ model: 'users', key: 'user_id' }),
    });
    await queryInterface.createTable('player_match_statistics', {
      stat_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      player_id: uuid({ model: 'players', key: 'player_id' }),
      runs_scored: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      balls_faced: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      fours: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      sixes: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      strike_rate: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
      overs_bowled: { type: DataTypes.DECIMAL(4, 1), allowNull: false, defaultValue: 0 },
      runs_conceded: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      wickets_taken: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      economy_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      catches: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      run_outs: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      stumpings: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      computed_at: ts(),
    });

    await queryInterface.createTable('player_rating_events', {
      rating_event_id: uuidPk(),
      player_id: uuid({ model: 'players', key: 'player_id' }),
      match_id: uuid({ model: 'matches', key: 'match_id' }, true),
      event_type: enumCol(RATING_EVENT_TYPES, false),
      rating_dimension: enumCol(RATING_DIMENSIONS, false),
      rating_delta: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
      resulting_value: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
      created_by: uuid({ model: 'users', key: 'user_id' }, true),
      created_at: ts(),
    });

    await queryInterface.createTable('match_intro', {
      intro_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      countdown_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      background_music_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      playing_xi_confirmed_team_a: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      playing_xi_confirmed_team_b: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      intro_played_at: ts(true),
    });
    await queryInterface.createTable('live_match_sessions', {
      viewer_session_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      user_id: uuid({ model: 'users', key: 'user_id' }, true),
      socket_id: { type: DataTypes.STRING(50), allowNull: false },
      connected_at: ts(),
      disconnected_at: ts(true),
    });

    await queryInterface.createTable('notifications', {
      notification_id: uuidPk(),
      user_id: uuid({ model: 'users', key: 'user_id' }),
      notification_type: enumCol(NOTIFICATION_TYPES, false),
      title: { type: DataTypes.STRING(150), allowNull: false },
      body: { type: DataTypes.STRING(500), allowNull: false },
      related_entity_type: { type: DataTypes.STRING(50), allowNull: true },
      related_entity_id: { type: DataTypes.UUID, allowNull: true },
      delivery_channel: enumCol(DELIVERY_CHANNELS, false, 'PUSH'),
      delivery_status: enumCol(DELIVERY_STATUSES, false, 'PENDING'),
      created_at: ts(),
      read_at: ts(true),
    });
    await queryInterface.createTable('audit_logs', {
      log_id: uuidPk(),
      actor_user_id: uuid({ model: 'users', key: 'user_id' }, true),
      actor_role: { type: DataTypes.STRING(30), allowNull: true },
      action: { type: DataTypes.STRING(100), allowNull: false },
      resource_type: { type: DataTypes.STRING(50), allowNull: false },
      resource_id: { type: DataTypes.UUID, allowNull: false },
      before_data: { type: DataTypes.JSON, allowNull: true },
      after_data: { type: DataTypes.JSON, allowNull: true },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      request_id: { type: DataTypes.UUID, allowNull: true },
      created_at: ts(),
    });
    await queryInterface.createTable('support_tickets', {
      ticket_id: uuidPk(),
      raised_by: uuid({ model: 'users', key: 'user_id' }),
      category: enumCol(SUPPORT_CATEGORIES, false),
      description: { type: DataTypes.TEXT, allowNull: false },
      related_entity_type: { type: DataTypes.STRING(50), allowNull: true },
      related_entity_id: { type: DataTypes.UUID, allowNull: true },
      status: enumCol(SUPPORT_STATUSES, false, 'OPEN'),
      assigned_to: uuid({ model: 'users', key: 'user_id' }, true),
      created_at: ts(),
      resolved_at: ts(true),
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const tables = [
      'support_tickets',
      'audit_logs',
      'notifications',
      'live_match_sessions',
      'match_intro',
      'player_rating_events',
      'player_match_statistics',
      'match_results',
      'score_events',
      'innings',
      'payment_events',
      'refunds',
      'payment_allocations',
      'payments',
      'payment_obligations',
      'player_replacements',
      'match_invitations',
      'match_players',
      'match_teams',
      'matches',
      'bookings',
      'turf_operating_hours',
      'turf_facilities',
      'turf_images',
      'turf_availability_blocks',
      'turf_staff_assignments',
      'turf_pricing',
      'turfs',
      'team_join_requests',
      'team_invitations',
      'team_members',
      'teams',
      'players',
      'users',
    ];
    for (const table of tables) {
      await queryInterface.dropTable(table);
    }
  },
};
