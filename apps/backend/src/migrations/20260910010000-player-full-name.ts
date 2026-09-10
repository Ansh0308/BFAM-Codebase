import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Backlog A-9: players had no stored human-readable name at all — every
// screen showed a BFAM ID because that was the only identifier that
// existed. Nullable since existing players predate this field and haven't
// necessarily set one yet; every display site falls back to bfam_id when
// it's null.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('players', 'full_name', {
      type: DataTypes.STRING(100),
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('players', 'full_name');
  },
};
