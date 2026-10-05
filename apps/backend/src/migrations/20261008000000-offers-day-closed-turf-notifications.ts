import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import { BLOCK_REASONS, NOTIFICATION_TYPES } from '../domain/constants';

// - notifications.notification_type gains TURF_UPDATE (an owner is told when an
//   admin approves or rejects their turf).
// - turf_availability_blocks.reason gains DAY_CLOSED: "closed for the day", set
//   and cleared from the staff desk / owner dashboard (SW-5). It reuses the
//   booking-time block check, so a closed turf simply cannot be booked.
// - promo_codes gains owner_id / turf_id: an owner's own offer (OW-8). A code
//   with an owner only applies to bookings at that owner's turfs (and at one
//   turf when turf_id is set); admin codes leave both NULL and apply everywhere.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.changeColumn('notifications', 'notification_type', {
      type: DataTypes.ENUM(...NOTIFICATION_TYPES),
      allowNull: false,
    });
    await queryInterface.changeColumn('turf_availability_blocks', 'reason', {
      type: DataTypes.ENUM(...BLOCK_REASONS),
      allowNull: false,
    });
    await queryInterface.addColumn('promo_codes', 'owner_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'user_id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('promo_codes', 'turf_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'turfs', key: 'turf_id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('promo_codes', ['owner_id'], { name: 'ix_promo_codes_owner' });
  },

  down: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.removeIndex('promo_codes', 'ix_promo_codes_owner');
    await queryInterface.removeColumn('promo_codes', 'turf_id');
    await queryInterface.removeColumn('promo_codes', 'owner_id');
    await queryInterface.changeColumn('turf_availability_blocks', 'reason', {
      type: DataTypes.ENUM(...BLOCK_REASONS.filter((r) => r !== 'DAY_CLOSED')),
      allowNull: false,
    });
    await queryInterface.changeColumn('notifications', 'notification_type', {
      type: DataTypes.ENUM(...NOTIFICATION_TYPES.filter((t) => t !== 'TURF_UPDATE')),
      allowNull: false,
    });
  },
};
