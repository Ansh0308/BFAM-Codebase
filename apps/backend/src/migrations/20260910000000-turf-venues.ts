import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

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

// Feedback backlog A-2: an owner with more than one pitch/turf at the same
// physical location (e.g. "Redline Sports Complex — Pitch 1 / Pitch 2").
// Each pitch stays exactly what a `turfs` row already is today — its own
// independently bookable listing, own pricing, own availability, own
// booking flow — `venues` is purely a grouping/display layer on top, not a
// new booking unit. `turfs.venue_id` is nullable so every existing turf
// (and every future standalone, single-pitch owner) is completely
// unaffected — venue_id stays NULL and nothing about it changes.
//
// A pitch's own address_line/city/latitude/longitude columns are kept
// (not dropped) rather than normalized away, so every existing read query
// (turfService.listTurfs, getTurfDetails, Discover's distance sort, etc.)
// keeps working unchanged. When a pitch belongs to a venue, those columns
// are populated FROM the venue at creation/link time and kept in sync if
// the venue's address is edited later (ownerService.updateVenue cascades
// the change) — confirmed with the founder: a venue's pitches share one
// real-world address, not independently-editable ones.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('venues', {
      venue_id: uuidPk(),
      owner_id: uuid({ model: 'users', key: 'user_id' }),
      venue_name: { type: DataTypes.STRING(150), allowNull: false },
      address_line: { type: DataTypes.STRING(255), allowNull: false },
      city: { type: DataTypes.STRING(100), allowNull: false },
      latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
      longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
      created_at: ts(),
      updated_at: ts(),
      deleted_at: ts(true),
    });

    await queryInterface.addColumn(
      'turfs',
      'venue_id',
      uuid({ model: 'venues', key: 'venue_id' }, true),
    );
    await queryInterface.addIndex('turfs', ['venue_id'], { name: 'ix_turfs_venue_id' });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex('turfs', 'ix_turfs_venue_id');
    await queryInterface.removeColumn('turfs', 'venue_id');
    await queryInterface.dropTable('venues');
  },
};
