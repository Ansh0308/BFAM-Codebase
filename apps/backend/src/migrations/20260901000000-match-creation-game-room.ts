import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import {
  ATTENDANCE_STATUSES,
  MATCH_CONFIRMATION_STATUSES,
  REMINDER_THRESHOLDS,
} from '../domain/constants';

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
const enumCol = (values: readonly string[], allowNull = false, defaultValue?: string) => ({
  type: DataTypes.ENUM(...values),
  allowNull,
  ...(defaultValue ? { defaultValue } : {}),
});

// Module 2.6 (Match Creation & Game Room):
// - match_players.invitation_status widens from the generic
//   PENDING/ACCEPTED/REJECTED/EXPIRED to the richer per-match RSVP states
//   the Player Confirmation flow needs (PRD §12.12).
// - match_players.attendance_status gains RUNNING_LATE (PRD §12.14).
// - matches gets a check_in_code for QR-based Check-In (PRD §12.48).
// - matches.booking_id becomes unique — one match per booking.
// - match_reminders_sent tracks which of the 24h/3h/1h/15min thresholds
//   (PRD §12.13) have already fired for a match, so the reminder ticker
//   stays idempotent across restarts/concurrent ticks.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.changeColumn(
      'match_players',
      'invitation_status',
      enumCol(MATCH_CONFIRMATION_STATUSES, false, 'PENDING'),
    );
    await queryInterface.changeColumn(
      'match_players',
      'attendance_status',
      enumCol(ATTENDANCE_STATUSES, false, 'PENDING'),
    );

    await queryInterface.addColumn('matches', 'check_in_code', {
      type: DataTypes.STRING(8),
      allowNull: true,
    });
    await queryInterface.addConstraint('matches', {
      fields: ['booking_id'],
      type: 'unique',
      name: 'uk_matches_booking_id',
    });

    await queryInterface.createTable('match_reminders_sent', {
      reminder_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      threshold: enumCol(REMINDER_THRESHOLDS, false),
      sent_at: ts(),
    });
    await queryInterface.addConstraint('match_reminders_sent', {
      fields: ['match_id', 'threshold'],
      type: 'unique',
      name: 'uk_match_reminders_sent_match_threshold',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('match_reminders_sent');
    await queryInterface.removeConstraint('matches', 'uk_matches_booking_id');
    await queryInterface.removeColumn('matches', 'check_in_code');
    await queryInterface.changeColumn(
      'match_players',
      'attendance_status',
      enumCol(['PENDING', 'CHECKED_IN', 'NO_SHOW'], false, 'PENDING'),
    );
    await queryInterface.changeColumn(
      'match_players',
      'invitation_status',
      enumCol(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'], false, 'PENDING'),
    );
  },
};
