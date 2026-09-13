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

// Backlog B-6: home page carousel/slider for offers, plus a minimal admin
// CMS (ADMIN-only, same "no dedicated content-management surface yet" gap
// noted throughout this backlog) to create/schedule/manage what appears
// in it. `starts_at`/`ends_at` are both nullable — a banner with neither
// set is active immediately and indefinitely, exactly like `is_active`
// with no scheduling at all; scheduling is opt-in, not required.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('home_banners', {
      banner_id: uuidPk(),
      title: { type: DataTypes.STRING(150), allowNull: false },
      image_url: { type: DataTypes.STRING(500), allowNull: false },
      link_url: { type: DataTypes.STRING(500), allowNull: true },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      starts_at: ts(true),
      ends_at: ts(true),
      created_by: uuid({ model: 'users', key: 'user_id' }, true),
      created_at: ts(),
      updated_at: ts(),
    });
    await queryInterface.addIndex('home_banners', ['is_active', 'display_order'], {
      name: 'ix_home_banners_active_order',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('home_banners');
  },
};
