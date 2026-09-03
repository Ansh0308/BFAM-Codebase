import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Module 2.13 (Support). Two additions:
//
// 1. support_tickets.dispute_type — distinguishes an in-app scoring/result
//    dispute (PRD §32.2) and an injury report (PRD §32.9) from a plain
//    complaint, all sharing the same table/category enum rather than
//    three separate ones.
//
// 2. users.liability_waiver_accepted_at — PRD §32.9 ties the injury report
//    flow to "the liability waiver captured during onboarding", but no
//    such capture exists anywhere in module 2.1's actual implementation
//    (checked: no waiver/consent field in the users/players schema, no
//    consent step in the signup screen or its validation schema). Rather
//    than silently pretending a waiver was collected, this column is
//    added and stamped at account-creation time in createUserAccount —
//    the closest honest equivalent available without reopening 2.1's
//    onboarding UI, which is out of this module's scope. Flagged to the
//    user as a real gap: a dedicated consent screen belongs in module 2.1.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('support_tickets', 'dispute_type', {
      type: DataTypes.ENUM('COMPLAINT', 'MATCH_DISPUTE', 'INJURY_REPORT'),
      allowNull: false,
      defaultValue: 'COMPLAINT',
    });
    await queryInterface.addColumn('users', 'liability_waiver_accepted_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('users', 'liability_waiver_accepted_at');
    await queryInterface.removeColumn('support_tickets', 'dispute_type');
  },
};
