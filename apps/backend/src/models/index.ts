import { DataTypes, ModelAttributes, Sequelize } from 'sequelize';

type TableModelDefinition = {
  tableName: string;
  primaryKey: string;
  attributes: ModelAttributes;
};

const id = (primaryKey = false) => ({ type: DataTypes.UUID, primaryKey, allowNull: !primaryKey });
const date = (allowNull = false) => ({ type: DataTypes.DATE, allowNull });

export const tableModelDefinitions: TableModelDefinition[] = [
  {
    tableName: 'users',
    primaryKey: 'user_id',
    attributes: {
      user_id: id(true),
      phone_number: DataTypes.STRING(15),
      email: DataTypes.STRING(255),
      password_hash: DataTypes.STRING(255),
      role: DataTypes.STRING(30),
      account_status: DataTypes.STRING(30),
      bfam_id: DataTypes.STRING(15),
    },
  },
  {
    tableName: 'players',
    primaryKey: 'player_id',
    attributes: {
      player_id: id(true),
      user_id: id(),
      bfam_id: DataTypes.STRING(15),
      playing_role: DataTypes.STRING(30),
      batting_style: DataTypes.STRING(30),
      bowling_style: DataTypes.STRING(30),
      experience_level: DataTypes.STRING(30),
      skill_rating: DataTypes.INTEGER,
      reliability_score: DataTypes.DECIMAL(5, 2),
    },
  },
  ...[
    ['teams', 'team_id'],
    ['team_members', 'team_member_id'],
    ['team_invitations', 'invitation_id'],
    ['team_join_requests', 'request_id'],
    ['turfs', 'turf_id'],
    ['turf_pricing', 'pricing_id'],
    ['turf_staff_assignments', 'assignment_id'],
    ['turf_availability_blocks', 'block_id'],
    ['turf_images', 'image_id'],
    ['turf_facilities', 'facility_id'],
    ['turf_operating_hours', 'hours_id'],
    ['bookings', 'booking_id'],
    ['matches', 'match_id'],
    ['match_teams', 'match_team_id'],
    ['match_players', 'match_player_id'],
    ['match_invitations', 'invitation_id'],
    ['player_replacements', 'replacement_id'],
    ['payment_obligations', 'obligation_id'],
    ['payments', 'payment_id'],
    ['payment_allocations', 'allocation_id'],
    ['refunds', 'refund_id'],
    ['innings', 'innings_id'],
    ['score_events', 'score_event_id'],
    ['match_results', 'result_id'],
    ['player_match_statistics', 'stat_id'],
    ['player_rating_events', 'rating_event_id'],
    ['match_intro', 'intro_id'],
    ['live_match_sessions', 'viewer_session_id'],
    ['notifications', 'notification_id'],
    ['audit_logs', 'log_id'],
    ['support_tickets', 'ticket_id'],
  ].map(([tableName, primaryKey]) => ({
    tableName,
    primaryKey,
    attributes: { [primaryKey]: id(true), created_at: date(true), updated_at: date(true) },
  })),
];

export function initModels(sequelize: Sequelize) {
  return Object.fromEntries(
    tableModelDefinitions.map((definition) => [
      definition.tableName,
      sequelize.define(definition.tableName, definition.attributes, {
        tableName: definition.tableName,
        underscored: true,
        timestamps: false,
      }),
    ]),
  );
}
