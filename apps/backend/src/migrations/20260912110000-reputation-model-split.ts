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

// Backlog G-01/G-02/G-03: PRD §19 requires Fair Play Rating, Reliability
// Score, and Community Rating as three separate reputation signals, but
// only one column (`players.reliability_score`) ever existed, doing double
// duty as both Fair Play (participation fairness, a property of the match)
// and Reliability (attendance/no-show behavior, a property of the player).
// This migration:
//  - adds `players.fair_play_rating`, the real home for the participation-
//    fairness metric that was previously (mis)written to reliability_score;
//    `reliability_score` itself is left alone — it keeps its column, still
//    starts at 100, but from here on is only ever moved by actual
//    attendance/no-show events (see statisticsService.ts's new
//    materializeReliabilityEvents).
//  - adds `players.community_rating`, nullable — null means "not enough
//    peer ratings yet" (PRD §12.31's sportsmanship/community signal),
//    distinct from a real 0 rating.
//  - widens `player_rating_events.rating_dimension` to include 'FAIR_PLAY'
//    (previously FAIR_PLAY events were incorrectly filed under the
//    'RELIABILITY' dimension).
//  - adds `player_ratings`, a peer-to-peer "how was this player to play
//    with" table for Community Rating, modeled directly on the existing
//    `reviews` table (backlog B-4) — same recompute-the-average-on-write
//    pattern, same one-per-(match, rater, ratee) uniqueness rule.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('players', 'fair_play_rating', {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 100,
    });
    await queryInterface.addColumn('players', 'community_rating', {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    });

    await queryInterface.changeColumn('player_rating_events', 'rating_dimension', {
      type: DataTypes.ENUM('SKILL', 'RELIABILITY', 'FAIR_PLAY'),
      allowNull: false,
    });

    await queryInterface.createTable('player_ratings', {
      player_rating_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      rater_player_id: uuid({ model: 'players', key: 'player_id' }),
      ratee_player_id: uuid({ model: 'players', key: 'player_id' }),
      rating: { type: DataTypes.SMALLINT, allowNull: false },
      created_at: ts(),
    });
    await queryInterface.addIndex('player_ratings', ['ratee_player_id'], {
      name: 'ix_player_ratings_ratee',
    });
    // One rating per (match, rater, ratee) — a rater can rate every other
    // confirmed teammate once per match, never twice.
    await queryInterface.addIndex(
      'player_ratings',
      ['match_id', 'rater_player_id', 'ratee_player_id'],
      { name: 'ux_player_ratings_triple', unique: true },
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('player_ratings');
    await queryInterface.changeColumn('player_rating_events', 'rating_dimension', {
      type: DataTypes.ENUM('SKILL', 'RELIABILITY'),
      allowNull: false,
    });
    await queryInterface.removeColumn('players', 'community_rating');
    await queryInterface.removeColumn('players', 'fair_play_rating');
  },
};
