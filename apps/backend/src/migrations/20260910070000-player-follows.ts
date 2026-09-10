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

// Backlog B-9: a follows social graph between players — follower/
// following counts on the public profile (backlog B-10), and a
// notification when someone a player follows starts playing a match.
// Self-follow is rejected in application code (followService.ts), not a
// DB constraint — MySQL CHECK constraints referencing two columns of the
// same row work in 8.0 but keeping the rule in one place (the service,
// which already has to validate the target player exists) is simpler.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('player_follows', {
      follow_id: uuidPk(),
      follower_player_id: uuid({ model: 'players', key: 'player_id' }),
      followed_player_id: uuid({ model: 'players', key: 'player_id' }),
      created_at: ts(),
    });
    await queryInterface.addIndex('player_follows', ['follower_player_id', 'followed_player_id'], {
      name: 'ux_player_follows_pair',
      unique: true,
    });
    await queryInterface.addIndex('player_follows', ['followed_player_id'], {
      name: 'ix_player_follows_followed',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('player_follows');
  },
};
