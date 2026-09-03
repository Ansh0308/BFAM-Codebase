import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import { NOTIFICATION_TYPES } from '../domain/constants';

const uuid = (references?: { model: string; key: string }, allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references,
  onUpdate: 'CASCADE',
  onDelete: allowNull ? 'SET NULL' : 'RESTRICT',
});
const ts = (allowNull = false) => ({ type: DataTypes.DATE, allowNull });

// Module 2.11 (Notifications, PRD §12.45): widens notifications.
// notification_type from the Phase 1 starter set (4 values) to one type
// per PRD §12.45 event, and adds notification_preferences — the Phase 1
// schema never had anywhere to persist the toggles on the Notification
// Settings screen (module 2.2), so they were local-state-only until now.
module.exports = {
  // A user with no row here simply gets the same defaults this table
  // declares (see notificationService.ts's getNotificationPreferences) —
  // rows are created lazily on first read/write, so no backfill is needed
  // for users that already existed before this migration.
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.changeColumn('notifications', 'notification_type', {
      type: DataTypes.ENUM(...NOTIFICATION_TYPES),
      allowNull: false,
    });

    await queryInterface.createTable('notification_preferences', {
      user_id: { ...uuid({ model: 'users', key: 'user_id' }), primaryKey: true },
      match_updates: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      booking_reminders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      team_invites: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      promotions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: ts(),
      updated_at: ts(),
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('notification_preferences');
    await queryInterface.changeColumn('notifications', 'notification_type', {
      type: DataTypes.ENUM('MATCH_REMINDER', 'BOOKING_UPDATE', 'PAYMENT_UPDATE', 'TEAM_INVITE'),
      allowNull: false,
    });
  },
};
