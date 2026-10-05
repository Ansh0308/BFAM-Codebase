import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Tournament follow-ups:
// - tournament_teams.payment_id: the online (Razorpay) payment that settled the
//   entry fee, so a gateway-paid entry can be told apart from one the host
//   recorded as cash.
// - matches.tournament_id: a match created for a tournament fixture. When set,
//   only the tournament's host may run the toss and score it.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('tournament_teams', 'payment_id', {
      type: DataTypes.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('matches', 'tournament_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'tournaments', key: 'tournament_id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('matches', ['tournament_id'], { name: 'ix_matches_tournament' });
  },

  down: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.removeIndex('matches', 'ix_matches_tournament');
    await queryInterface.removeColumn('matches', 'tournament_id');
    await queryInterface.removeColumn('tournament_teams', 'payment_id');
  },
};
