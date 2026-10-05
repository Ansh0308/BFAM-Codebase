import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Tournaments (PRD §9.1 / §9.2): an event with teams, a league and / or a
// knockout bracket, and a points table.
//
// - `tournaments.turf_id` is NULL for a platform-wide (admin) tournament.
// - Fixtures belong to the tournament and refer to `tournament_teams` entries
//   (not directly to teams) so a team's seed / payment / approval live with
//   its entry. A fixture can optionally link to a real `matches` row.
// - Results are entered by the organiser (runs / wickets / balls per side) and
//   feed the points table and net run rate.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    const uuidFk = (model: string, key: string, allowNull = false) => ({
      type: DataTypes.UUID,
      allowNull,
      references: { model, key },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.createTable('tournaments', {
      tournament_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      format: {
        type: DataTypes.ENUM('LEAGUE', 'KNOCKOUT', 'LEAGUE_KNOCKOUT'),
        allowNull: false,
      },
      organiser_id: uuidFk('users', 'user_id'),
      turf_id: uuidFk('turfs', 'turf_id', true),
      overs_per_innings: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 6 },
      entry_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      min_teams: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 2 },
      max_teams: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 16 },
      double_round: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      start_date: { type: DataTypes.DATEONLY, allowNull: true },
      registration_deadline: { type: DataTypes.DATEONLY, allowNull: true },
      status: {
        type: DataTypes.ENUM('DRAFT', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      champion_entry_id: { type: DataTypes.UUID, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });
    await queryInterface.addIndex('tournaments', ['status'], { name: 'ix_tournaments_status' });
    await queryInterface.addIndex('tournaments', ['turf_id'], { name: 'ix_tournaments_turf' });

    await queryInterface.createTable('tournament_teams', {
      entry_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      tournament_id: uuidFk('tournaments', 'tournament_id'),
      team_id: uuidFk('teams', 'team_id'),
      registered_by: uuidFk('users', 'user_id', true),
      status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      payment_status: {
        type: DataTypes.ENUM('NOT_REQUIRED', 'UNPAID', 'PAID'),
        allowNull: false,
        defaultValue: 'NOT_REQUIRED',
      },
      payment_reference: { type: DataTypes.STRING(100), allowNull: true },
      paid_at: { type: DataTypes.DATE, allowNull: true },
      seed: { type: DataTypes.SMALLINT, allowNull: true },
      registered_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('tournament_teams', {
      fields: ['tournament_id', 'team_id'],
      type: 'unique',
      name: 'uk_tournament_teams_tournament_team',
    });

    await queryInterface.createTable('tournament_fixtures', {
      fixture_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      tournament_id: uuidFk('tournaments', 'tournament_id'),
      stage: { type: DataTypes.ENUM('LEAGUE', 'KNOCKOUT'), allowNull: false },
      round_number: { type: DataTypes.SMALLINT, allowNull: false },
      match_number: { type: DataTypes.SMALLINT, allowNull: false },
      team_a_entry_id: uuidFk('tournament_teams', 'entry_id', true),
      team_b_entry_id: uuidFk('tournament_teams', 'entry_id', true),
      next_match_number: { type: DataTypes.SMALLINT, allowNull: true },
      next_slot: { type: DataTypes.ENUM('A', 'B'), allowNull: true },
      scheduled_at: { type: DataTypes.DATE, allowNull: true },
      venue_note: { type: DataTypes.STRING(150), allowNull: true },
      status: {
        type: DataTypes.ENUM('SCHEDULED', 'COMPLETED'),
        allowNull: false,
        defaultValue: 'SCHEDULED',
      },
      result_type: { type: DataTypes.ENUM('WIN', 'TIE', 'NO_RESULT'), allowNull: true },
      winner_entry_id: uuidFk('tournament_teams', 'entry_id', true),
      team_a_runs: { type: DataTypes.SMALLINT, allowNull: true },
      team_a_wickets: { type: DataTypes.SMALLINT, allowNull: true },
      team_a_balls: { type: DataTypes.SMALLINT, allowNull: true },
      team_b_runs: { type: DataTypes.SMALLINT, allowNull: true },
      team_b_wickets: { type: DataTypes.SMALLINT, allowNull: true },
      team_b_balls: { type: DataTypes.SMALLINT, allowNull: true },
      match_id: uuidFk('matches', 'match_id', true),
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('tournament_fixtures', {
      fields: ['tournament_id', 'match_number'],
      type: 'unique',
      name: 'uk_tournament_fixtures_number',
    });
  },

  down: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.dropTable('tournament_fixtures');
    await queryInterface.dropTable('tournament_teams');
    await queryInterface.dropTable('tournaments');
  },
};
