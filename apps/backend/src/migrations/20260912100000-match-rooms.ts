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

// Backlog B-11: a pre-match "room" — an online-game-lobby-style flow that
// runs alongside today's book-first match creation, not a replacement for
// it. A captain opens a room, other players discover and join it, and
// once the captain is ready they book a turf and convert the room into a
// real match — carrying the room's assembled roster into the match invite
// step, and the captain's side-split (manual or random, editable up until
// conversion) into match_players.match_team_id directly, which also closes
// backlog A-10's "batter/bowler selectable from either side" gap for
// rooms specifically (book-first matches still don't set this — a
// separate, not-yet-built step per A-10).
//
// A room is deliberately NOT linked to the persistent `teams` entity —
// per product decision, a room is always disposable once its match starts,
// never offered as "save this group as a team" (that would reuse backlog
// A-11's copy-team precedent, but was explicitly scoped out here).
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('rooms', {
      room_id: uuidPk(),
      room_name: { type: DataTypes.STRING(120), allowNull: false },
      captain_user_id: uuid({ model: 'users', key: 'user_id' }),
      ball_type: { type: DataTypes.STRING(30), allowNull: false },
      overs_per_innings: { type: DataTypes.INTEGER, allowNull: false },
      max_players: { type: DataTypes.INTEGER, allowNull: false },
      // FILLING: open for players to join. READY: captain has split sides
      // and is about to book a turf. CONVERTED: booked + a real match was
      // created (match_id set). CANCELLED: captain abandoned the room.
      room_status: {
        type: DataTypes.ENUM('FILLING', 'READY', 'CONVERTED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'FILLING',
      },
      match_id: uuid({ model: 'matches', key: 'match_id' }, true),
      created_at: ts(),
      updated_at: ts(),
    });
    await queryInterface.addIndex('rooms', ['room_status'], { name: 'ix_rooms_status' });
    await queryInterface.addIndex('rooms', ['captain_user_id'], { name: 'ix_rooms_captain' });

    await queryInterface.createTable('room_players', {
      room_player_id: uuidPk(),
      room_id: uuid({ model: 'rooms', key: 'room_id' }),
      player_id: uuid({ model: 'players', key: 'player_id' }),
      // Assigned by the captain's manual split or random shuffle, editable
      // (re-assignable) any number of times before the room converts.
      side: {
        type: DataTypes.ENUM('UNASSIGNED', 'TEAM_A', 'TEAM_B'),
        allowNull: false,
        defaultValue: 'UNASSIGNED',
      },
      is_captain: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      joined_at: ts(),
    });
    await queryInterface.addIndex('room_players', ['room_id', 'player_id'], {
      name: 'ux_room_players_pair',
      unique: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('room_players');
    await queryInterface.dropTable('rooms');
  },
};
