import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import { randomUUID } from 'crypto';

// Long tail — Memberships (PRD §12.51): recurring loyalty tier with plans,
// discounts, and expiry. Scoping decisions (no founder available — see
// RESUME_STATE.md):
// - Plans are bought with BFAM Coins (existing coinsService), not money —
//   collecting recurring real-money payments needs a Razorpay
//   subscription flow that doesn't exist here. Swap the payment step when
//   it does; the plan/expiry model doesn't change.
// - discount_percent is stored and shown on the plan/membership, but is
//   NOT yet applied at booking checkout — checkoutService's promo+coin
//   stacking has a ₹1 floor and trimming order that a third discount
//   source needs deliberate design for, so it's left as a follow-up.
// - Subscribing while already a member extends from the current expiry
//   rather than from today, so early renewal never loses days.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.changeColumn('coin_transactions', 'reason', {
      type: DataTypes.ENUM(
        'REVIEW_REWARD',
        'BOOKING_REDEMPTION',
        'ADMIN_ADJUSTMENT',
        'REFERRAL_REWARD',
        'REWARD_REDEMPTION',
        'MEMBERSHIP_PURCHASE',
      ),
      allowNull: false,
    });

    await queryInterface.createTable('membership_plans', {
      plan_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      duration_days: { type: DataTypes.INTEGER, allowNull: false },
      coin_cost: { type: DataTypes.INTEGER, allowNull: false },
      discount_percent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('player_memberships', {
      membership_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      player_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'players', key: 'player_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      plan_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'membership_plans', key: 'plan_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      started_at: { type: DataTypes.DATE, allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('player_memberships', ['player_id', 'expires_at'], {
      name: 'ix_player_memberships_player_expiry',
    });

    const now = new Date();
    await queryInterface.bulkInsert('membership_plans', [
      {
        plan_id: randomUUID(),
        name: 'Monthly Member',
        duration_days: 30,
        coin_cost: 1500,
        discount_percent: 10,
        is_active: true,
        created_at: now,
      },
      {
        plan_id: randomUUID(),
        name: 'Annual Member',
        duration_days: 365,
        coin_cost: 12000,
        discount_percent: 15,
        is_active: true,
        created_at: now,
      },
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('player_memberships');
    await queryInterface.dropTable('membership_plans');
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
  },
};
