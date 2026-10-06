import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Phase 9:
// - platform_settings: admin-editable values (refund windows, coin and referral
//   values, support and legal links, maintenance mode, minimum app version) as
//   key / JSON rows. Anything not stored falls back to the built-in default, so
//   an empty table behaves exactly as the app did before.
// - home_content_items: what the admin pins to the app's Home screen — featured
//   offers, turfs, tournaments and short announcements.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('platform_settings', {
      setting_key: { type: DataTypes.STRING(100), allowNull: false, primaryKey: true },
      setting_value: { type: DataTypes.JSON, allowNull: false },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('home_content_items', {
      item_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      kind: {
        type: DataTypes.ENUM('OFFER', 'TURF', 'TOURNAMENT', 'ANNOUNCEMENT'),
        allowNull: false,
      },
      // The promo code / turf / tournament this card points at (NULL for an announcement).
      ref_id: { type: DataTypes.UUID, allowNull: true },
      title: { type: DataTypes.STRING(120), allowNull: true },
      body: { type: DataTypes.STRING(400), allowNull: true },
      link_url: { type: DataTypes.STRING(500), allowNull: true },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      starts_at: { type: DataTypes.DATE, allowNull: true },
      ends_at: { type: DataTypes.DATE, allowNull: true },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('home_content_items', ['is_active', 'display_order'], {
      name: 'ix_home_content_active_order',
    });
  },

  down: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.dropTable('home_content_items');
    await queryInterface.dropTable('platform_settings');
  },
};
