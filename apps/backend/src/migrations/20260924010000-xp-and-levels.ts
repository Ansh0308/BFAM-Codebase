import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Long tail — XP & Player Levels (PRD §12.35): "a separate progression
// system from BFAM Coins" — same append-only-ledger + cached-running-total
// shape as coin_transactions/players.coin_balance (backlog B-1), since
// that's already the established pattern in this codebase for "a number
// that only ever accumulates and needs an audit trail" (see also
// players.skill_rating from player_rating_events).
//
// Levels themselves (Newbie/Rookie/Player/Pro/Elite/Legend, PRD's example
// names) are NOT stored anywhere — they're computed from xp_total against
// a threshold table in code (services/xpService.ts), the same way a
// player's minor/age-gate MINIMUM_AGE_YEARS is a code constant rather than
// a database row. No product-specified thresholds exist, so this
// migration only adds the ledger; the thresholds are documented as MVP
// defaults in xpService.ts, not here.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('players', 'xp_total', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.createTable('xp_transactions', {
      xp_transaction_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      player_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'players', key: 'player_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      reason: {
        type: DataTypes.ENUM('REVIEW_REWARD', 'ADMIN_ADJUSTMENT'),
        allowNull: false,
      },
      amount: { type: DataTypes.INTEGER, allowNull: false },
      resulting_total: { type: DataTypes.INTEGER, allowNull: false },
      related_entity_type: { type: DataTypes.STRING(50), allowNull: true },
      related_entity_id: { type: DataTypes.UUID, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('xp_transactions', ['player_id'], {
      name: 'ix_xp_transactions_player_id',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('xp_transactions');
    await queryInterface.removeColumn('players', 'xp_total');
  },
};
