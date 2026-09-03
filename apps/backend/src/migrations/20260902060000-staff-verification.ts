import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import { STAFF_VERIFICATION_STATUSES } from '../domain/constants';

const uuid = (references?: { model: string; key: string }, allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references,
  onUpdate: 'CASCADE',
  onDelete: allowNull ? 'SET NULL' : 'RESTRICT',
});
const ts = (allowNull = false) => ({ type: DataTypes.DATE, allowNull });

// Module 2.12 (Turf Owner & Turf Staff, PRD §32.14): staff verification —
// an ID/document upload the owner reviews before the staff account gets
// live check-in/payment permissions. New staff assignments start PENDING.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('turf_staff_assignments', 'verification_status', {
      type: DataTypes.ENUM(...STAFF_VERIFICATION_STATUSES),
      allowNull: false,
      defaultValue: 'PENDING',
    });
    await queryInterface.addColumn('turf_staff_assignments', 'verification_document_url', {
      type: DataTypes.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn(
      'turf_staff_assignments',
      'verified_by',
      uuid({ model: 'users', key: 'user_id' }, true),
    );
    await queryInterface.addColumn('turf_staff_assignments', 'verified_at', ts(true));
    await queryInterface.addColumn('turf_staff_assignments', 'rejection_reason', {
      type: DataTypes.STRING(500),
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('turf_staff_assignments', 'rejection_reason');
    await queryInterface.removeColumn('turf_staff_assignments', 'verified_at');
    await queryInterface.removeColumn('turf_staff_assignments', 'verified_by');
    await queryInterface.removeColumn('turf_staff_assignments', 'verification_document_url');
    await queryInterface.removeColumn('turf_staff_assignments', 'verification_status');
  },
};
