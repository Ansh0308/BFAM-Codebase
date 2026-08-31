import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Adds gender collection for players (product request, 2026-08-30) —
// required in the Profile Setup UI (same screen/pattern as date_of_birth,
// added in the prior migration) but nullable at the DB level, same
// reasoning: existing rows have none, and the "required" rule is an app-
// layer concern, not a DB constraint.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('players', 'gender', {
      type: DataTypes.ENUM('MALE', 'FEMALE', 'OTHER'),
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('players', 'gender');
  },
};
