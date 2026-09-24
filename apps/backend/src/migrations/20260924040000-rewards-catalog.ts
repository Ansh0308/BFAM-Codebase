import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import { randomUUID } from 'crypto';

// Long tail — Rewards catalog (PRD §12.36): "redeemable benefits earned
// through play and engagement." Scoping decision (no founder available —
// see RESUME_STATE.md): a coin-priced catalog. Redeeming spends BFAM Coins
// (existing coinsService) and records a redemption for staff/admin to
// fulfil manually — BFAM has no automated hook into booking discounts,
// merchandise, or priority booking, so "fulfilment" is an out-of-band
// step tracked by status. Three placeholder rewards are seeded so the
// screen isn't empty; there is no admin UI to manage them yet (edit the
// table directly until one exists).
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.changeColumn('coin_transactions', 'reason', {
      type: DataTypes.ENUM(
        'REVIEW_REWARD',
        'BOOKING_REDEMPTION',
        'ADMIN_ADJUSTMENT',
        'REFERRAL_REWARD',
        'REWARD_REDEMPTION',
      ),
      allowNull: false,
    });

    await queryInterface.createTable('rewards', {
      reward_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.STRING(300), allowNull: true },
      coin_cost: { type: DataTypes.INTEGER, allowNull: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('reward_redemptions', {
      redemption_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      reward_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'rewards', key: 'reward_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      player_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'players', key: 'player_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      coins_spent: { type: DataTypes.INTEGER, allowNull: false },
      status: {
        type: DataTypes.ENUM('PENDING', 'FULFILLED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      created_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('reward_redemptions', ['player_id'], {
      name: 'ix_reward_redemptions_player',
    });

    const now = new Date();
    await queryInterface.bulkInsert('rewards', [
      {
        reward_id: randomUUID(),
        name: '10% Off Your Next Booking',
        description: 'A 10% discount on one turf booking. Show this at check-in.',
        coin_cost: 200,
        is_active: true,
        created_at: now,
      },
      {
        reward_id: randomUUID(),
        name: 'Priority Booking Pass',
        description: 'Book a peak-hour slot before it opens to everyone.',
        coin_cost: 500,
        is_active: true,
        created_at: now,
      },
      {
        reward_id: randomUUID(),
        name: 'BFAM Cap',
        description: 'Official BFAM merchandise, collected from a partner turf.',
        coin_cost: 1000,
        is_active: true,
        created_at: now,
      },
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('reward_redemptions');
    await queryInterface.dropTable('rewards');
    await queryInterface.changeColumn('coin_transactions', 'reason', {
      type: DataTypes.ENUM(
        'REVIEW_REWARD',
        'BOOKING_REDEMPTION',
        'ADMIN_ADJUSTMENT',
        'REFERRAL_REWARD',
      ),
      allowNull: false,
    });
  },
};
