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
const enumCol = (values: readonly string[], allowNull = false, defaultValue?: string) => ({
  type: DataTypes.ENUM(...values),
  allowNull,
  ...(defaultValue ? { defaultValue } : {}),
});

// Backlog B-1 (promo codes + BFAM Coins at checkout) and B-4 (turf/match
// review system with coin rewards) — designed together per the backlog's
// own note that B-4 needs the same coins ledger B-1 introduces.
//
// MVP defaults (no existing product decision to draw from — documented
// here so they're easy to find and tune later):
//  - 1 BFAM Coin = ₹1 of discount, redeemable up to the full amount due.
//  - A submitted review earns a flat 20 coins (COIN_REWARD_PER_REVIEW in
//    reviewService.ts), once per (player, match).
//  - A promo code is either a flat ₹ amount off or a percentage off
//    (optionally capped by max_discount_amount), gated by an optional
//    minimum booking amount, an optional overall usage cap, and an
//    optional per-player usage cap (default 1 — one redemption per code
//    per player, the common "first order" coupon shape).
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('players', 'coin_balance', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.createTable('coin_transactions', {
      coin_transaction_id: uuidPk(),
      player_id: uuid({ model: 'players', key: 'player_id' }),
      transaction_type: enumCol(['EARN', 'SPEND'], false),
      reason: enumCol(['REVIEW_REWARD', 'BOOKING_REDEMPTION', 'ADMIN_ADJUSTMENT'], false),
      amount: { type: DataTypes.INTEGER, allowNull: false },
      balance_after: { type: DataTypes.INTEGER, allowNull: false },
      related_entity_type: { type: DataTypes.STRING(50), allowNull: true },
      related_entity_id: { type: DataTypes.UUID, allowNull: true },
      created_at: ts(),
    });
    await queryInterface.addIndex('coin_transactions', ['player_id'], {
      name: 'ix_coin_transactions_player_id',
    });

    await queryInterface.createTable('promo_codes', {
      promo_code_id: uuidPk(),
      code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      discount_type: enumCol(['PERCENTAGE', 'FLAT'], false),
      discount_value: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      max_discount_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      min_booking_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      usage_limit_total: { type: DataTypes.INTEGER, allowNull: true },
      usage_limit_per_player: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
      valid_from: ts(true),
      valid_until: ts(true),
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: uuid({ model: 'users', key: 'user_id' }, true),
      created_at: ts(),
    });

    await queryInterface.createTable('promo_code_redemptions', {
      redemption_id: uuidPk(),
      promo_code_id: uuid({ model: 'promo_codes', key: 'promo_code_id' }),
      player_id: uuid({ model: 'players', key: 'player_id' }),
      obligation_id: uuid({ model: 'payment_obligations', key: 'obligation_id' }),
      discount_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      redeemed_at: ts(),
    });
    await queryInterface.addIndex('promo_code_redemptions', ['promo_code_id', 'player_id'], {
      name: 'ix_promo_redemptions_code_player',
    });

    await queryInterface.createTable('reviews', {
      review_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }, true),
      turf_id: uuid({ model: 'turfs', key: 'turf_id' }),
      player_id: uuid({ model: 'players', key: 'player_id' }),
      rating: { type: DataTypes.SMALLINT, allowNull: false },
      review_text: { type: DataTypes.TEXT, allowNull: true },
      coins_awarded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: ts(),
    });
    await queryInterface.addIndex('reviews', ['turf_id'], { name: 'ix_reviews_turf_id' });
    // One review per player per match — enforced at the DB level for the
    // common case (match_id present); a turf-only review (match_id NULL,
    // e.g. reviewing a turf without a specific match) isn't covered by
    // this constraint and is deduplicated in application code instead,
    // since MySQL treats every NULL as distinct under a UNIQUE index.
    await queryInterface.addIndex('reviews', ['match_id', 'player_id'], {
      name: 'ux_reviews_match_player',
      unique: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('reviews');
    await queryInterface.dropTable('promo_code_redemptions');
    await queryInterface.dropTable('promo_codes');
    await queryInterface.dropTable('coin_transactions');
    await queryInterface.removeColumn('players', 'coin_balance');
  },
};
