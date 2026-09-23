import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Backlog G-21 (PRD §32.8): consent capture with policy versioning. Until
// now only a single `users.liability_waiver_accepted_at` timestamp existed
// (added for backlog module 2.13's injury-report gate) — no record of
// *which* policy version was accepted, and no capture at all for the other
// three categories the PRD names (location, contacts, payment-data).
//
// Append-only log, not a single row per user: a user can re-accept a later
// policy version, and history should never be overwritten — the current
// state for a category is just "the most recent row for that user +
// consent_type", not a column that gets updated in place.
//
// Scoping decision (no founder available — see RESUME_STATE.md): one
// shared policy_version string is stamped across all four categories
// (they're sections of the same Terms & Privacy document, not four
// independently-versioned documents) rather than per-category version
// numbers — simpler and matches how the actual document is published.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('user_consents', {
      consent_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      consent_type: {
        type: DataTypes.ENUM('TERMS', 'LOCATION', 'CONTACTS', 'PAYMENT_DATA'),
        allowNull: false,
      },
      policy_version: { type: DataTypes.STRING(20), allowNull: false },
      accepted_at: { type: DataTypes.DATE, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('user_consents', ['user_id', 'consent_type']);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('user_consents');
  },
};
