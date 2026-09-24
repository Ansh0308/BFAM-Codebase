import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Match revamp (see .claude/MATCH_REVAMP_PLAN.md).
// - match_teams.team_name: a name for each side, set on the Match Setup
//   screen before the toss, so nobody has to guess who "Team A" is. Null
//   falls back to the linked real team's name, then to "Team A"/"Team B".
// - matches.no_non_striker: box-cricket single-batter mode. Defaults to
//   FALSE so every existing match keeps its two-batter behaviour; createMatch
//   sets it explicitly (true by default) for new matches.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('match_teams', 'team_name', {
      type: DataTypes.STRING(60),
      allowNull: true,
    });
    await queryInterface.addColumn('matches', 'no_non_striker', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('matches', 'no_non_striker');
    await queryInterface.removeColumn('match_teams', 'team_name');
  },
};
