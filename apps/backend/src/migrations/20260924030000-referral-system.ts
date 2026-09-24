import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Long tail — Referral System (PRD §12.53/§31.35): "Player Shares Referral
// Code → Friend Joins → Friend Completes Qualifying Action → Reward
// Issued." Scoping decision (no founder available — see RESUME_STATE.md):
//
// - Referral code = the referrer's own BFAM ID. Every player already has
//   one, unique and player-facing already (shown everywhere per backlog
//   A-18/A-9) — generating a second, separate code would just be a
//   redundant identifier for the same purpose. "Share your BFAM ID to
//   invite a friend" is the whole referral-code feature.
// - "Qualifying action" = the referred player's first completed match.
//   Concrete, unambiguous, and unfakeable by a throwaway signup — matches
//   the general shape of referral programs that reward real usage, not
//   just registration.
// - One referral per referred player (unique index below) — a player was
//   referred by exactly one person or nobody; the first valid referral
//   code entered at signup wins.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    // Widens coin_transactions.reason to add REFERRAL_REWARD alongside the
    // existing REVIEW_REWARD/BOOKING_REDEMPTION/ADMIN_ADJUSTMENT — a
    // referral reward is its own distinct reason, not an admin action.
    await queryInterface.changeColumn('coin_transactions', 'reason', {
      type: DataTypes.ENUM(
        'REVIEW_REWARD',
        'BOOKING_REDEMPTION',
        'ADMIN_ADJUSTMENT',
        'REFERRAL_REWARD',
      ),
      allowNull: false,
    });

    await queryInterface.createTable('referrals', {
      referral_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      referrer_player_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'players', key: 'player_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      referred_player_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'players', key: 'player_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'QUALIFIED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      reward_coins: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      qualified_at: { type: DataTypes.DATE, allowNull: true },
    });
    await queryInterface.addIndex('referrals', ['referred_player_id'], {
      name: 'ux_referrals_referred_player',
      unique: true,
    });
    await queryInterface.addIndex('referrals', ['referrer_player_id'], {
      name: 'ix_referrals_referrer_player',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('referrals');
    await queryInterface.changeColumn('coin_transactions', 'reason', {
      type: DataTypes.ENUM('REVIEW_REWARD', 'BOOKING_REDEMPTION', 'ADMIN_ADJUSTMENT'),
      allowNull: false,
    });
  },
};
