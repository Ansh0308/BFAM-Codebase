import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Backlog A-8: before scoring starts, let the organizer/scorer choose
// whether extras (wides, no-balls, byes, leg-byes) count toward the
// official team total, or are recorded for the record only. Defaults to
// true (standard cricket rules) so every existing match keeps behaving
// exactly as before. Lives on `matches` (not `match_intro`) so it's set
// once per match and readable from anywhere scoringService already loads
// the match row.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('matches', 'extras_count_toward_score', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('matches', 'extras_count_toward_score');
  },
};
