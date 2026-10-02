import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// A booked turf slot is usually an hour or two, and people play several matches in
// it, so one booking can now have many matches.
// - matches.booking_id stops being unique. MySQL needs SOME index on a foreign key
//   column, so a plain index is added first and only then is the unique one dropped
//   (dropping it first fails with "needed in a foreign key constraint").
// - matches.scheduled_end_time: when the match is meant to finish, so the slot can
//   be split into non-overlapping matches. Null on older matches, which are treated
//   as occupying the whole slot (as they always did).
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addIndex('matches', ['booking_id'], { name: 'idx_matches_booking_id' });
    await queryInterface.removeConstraint('matches', 'uk_matches_booking_id');
    await queryInterface.addColumn('matches', 'scheduled_end_time', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('matches', 'scheduled_end_time');
    // Only possible while no booking has more than one match.
    await queryInterface.addConstraint('matches', {
      fields: ['booking_id'],
      type: 'unique',
      name: 'uk_matches_booking_id',
    });
    await queryInterface.removeIndex('matches', 'idx_matches_booking_id');
  },
};
