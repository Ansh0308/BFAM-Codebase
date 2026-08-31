import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Local reference table for the Favorite Cricketer search (Module 2.2),
// replacing the API-only search that couldn't cover historical/all-time
// players. Seeded from Cricsheet's openly-licensed player registry
// (Open Data Commons Attribution — see src/seed/data/, attribution shown
// in the app) — see src/seed/cricketersSeed.ts for the import.
//
// `jersey_number` is a small, honestly-curated subset (no comprehensive
// open jersey-number database exists) and is intended to be expanded over
// time — kept as a real, directly-editable column for exactly that reason,
// not a hardcoded list in code.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('cricketers', {
      cricketer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'cricsheet' },
      source_id: { type: DataTypes.STRING(50), allowNull: false },
      external_id: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      display_name: { type: DataTypes.STRING(255), allowNull: false },
      jersey_number: { type: DataTypes.STRING(5), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('cricketers', ['display_name'], {
      name: 'idx_cricketers_display_name',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('cricketers');
  },
};
