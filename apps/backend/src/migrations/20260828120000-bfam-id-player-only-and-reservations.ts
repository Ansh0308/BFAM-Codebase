import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import { RESERVATION_STATUSES } from '../domain/constants';

// Two related schema changes, both explicitly requested by the product
// owner (superseding the PRD §12.59 note that a premium-ID marketplace was
// "out of scope for now" — see BFAM_PRD_v2.2.md's updated §12.59):
//
// 1. BFAM IDs are only ever issued to PLAYER accounts, not TURF_OWNER or
//    TURF_STAFF. `users.bfam_id` was NOT NULL for every role; it must
//    become nullable so non-player accounts can have none.
// 2. Admins can now LOCK a specific BFAM ID (e.g. "BF7", "BF18") so the
//    normal sequential allocator skips it, then later manually ASSIGN it
//    to a specific existing player. `reserved_bfam_ids` tracks this.
const uuidPk = () => ({
  type: DataTypes.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: DataTypes.UUIDV4,
});
const uuid = (references?: { model: string; key: string }, allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references,
  onUpdate: 'CASCADE',
  onDelete: allowNull ? 'SET NULL' : 'RESTRICT',
});
const ts = (allowNull = false) => ({ type: DataTypes.DATE, allowNull });

module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.changeColumn('users', 'bfam_id', {
      type: DataTypes.STRING(15),
      allowNull: true,
      unique: true,
    });

    await queryInterface.createTable('reserved_bfam_ids', {
      reservation_id: uuidPk(),
      bfam_id: { type: DataTypes.STRING(15), allowNull: false, unique: true },
      status: {
        type: DataTypes.ENUM(...RESERVATION_STATUSES),
        allowNull: false,
        defaultValue: 'LOCKED',
      },
      locked_by: uuid({ model: 'users', key: 'user_id' }),
      locked_at: ts(),
      notes: { type: DataTypes.STRING(255), allowNull: true },
      assigned_to_user_id: uuid({ model: 'users', key: 'user_id' }, true),
      assigned_at: ts(true),
      created_at: ts(),
      updated_at: ts(),
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('reserved_bfam_ids');
    await queryInterface.changeColumn('users', 'bfam_id', {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: true,
    });
  },
};
