import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Phase 7 (web gap analysis): turf approval + the owner maintenance tracker.
//
// - turfs.turf_status gains PENDING_APPROVAL and REJECTED (a new turf created
//   by an owner waits for an admin; players only ever see ACTIVE turfs, so a
//   pending one is invisible to them with no further change). Existing turfs
//   stay ACTIVE. `rejection_reason` records why a turf was refused.
// - maintenance_tasks: a per-turf task list with status, priority and cost.
//   (Staff permissions reuse the existing turf_staff_assignments.permissions
//   JSON column, so they need no schema change.)
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.changeColumn('turfs', 'turf_status', {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    });
    await queryInterface.addColumn('turfs', 'rejection_reason', {
      type: DataTypes.STRING(255),
      allowNull: true,
    });

    await queryInterface.createTable('maintenance_tasks', {
      task_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      turf_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'turfs', key: 'turf_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      title: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      category: {
        type: DataTypes.ENUM('PITCH', 'NETS', 'LIGHTING', 'FACILITIES', 'EQUIPMENT', 'OTHER'),
        allowNull: false,
        defaultValue: 'OTHER',
      },
      priority: {
        type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH'),
        allowNull: false,
        defaultValue: 'MEDIUM',
      },
      status: {
        type: DataTypes.ENUM('OPEN', 'IN_PROGRESS', 'DONE'),
        allowNull: false,
        defaultValue: 'OPEN',
      },
      due_date: { type: DataTypes.DATEONLY, allowNull: true },
      cost: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      assigned_to: { type: DataTypes.STRING(100), allowNull: true },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('maintenance_tasks', ['turf_id', 'status'], {
      name: 'ix_maintenance_turf_status',
    });
  },

  down: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.dropTable('maintenance_tasks');
    await queryInterface.removeColumn('turfs', 'rejection_reason');
    await queryInterface.changeColumn('turfs', 'turf_status', {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    });
  },
};
