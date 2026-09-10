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

// Backlog B-3: team/match chat room, scoped MVP to one room per match
// (rather than a separate standing per-team room) — persisted messages,
// delivered in real time over the existing Socket.IO layer (already used
// for live scoring / viewer presence), with SYSTEM-type rows for events
// like check-in and payment auto-pushed alongside player TEXT messages.
// sender_id is nullable specifically for SYSTEM messages, which have no
// human author.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('match_messages', {
      message_id: uuidPk(),
      match_id: uuid({ model: 'matches', key: 'match_id' }),
      sender_id: uuid({ model: 'users', key: 'user_id' }, true),
      message_type: {
        type: DataTypes.ENUM('TEXT', 'SYSTEM'),
        allowNull: false,
        defaultValue: 'TEXT',
      },
      body: { type: DataTypes.TEXT, allowNull: false },
      created_at: ts(),
    });
    await queryInterface.addIndex('match_messages', ['match_id', 'created_at'], {
      name: 'ix_match_messages_match_created',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('match_messages');
  },
};
