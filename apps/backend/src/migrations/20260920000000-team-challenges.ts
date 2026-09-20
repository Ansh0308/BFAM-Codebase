import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import { NOTIFICATION_TYPES } from '../domain/constants';

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

// Backlog B-13: Team vs Team Challenge Mode. A third path to a match,
// alongside book-first (module 2.6) and rooms (backlog B-11) — here the
// unit is an entire persisted team, not an individual player. Team A's
// captain challenges Team B; Team B's captain accepts or declines; on
// accept the app hands off into G-20's existing team-vs-team
// createMatch (home_team_id/away_team_id), so this migration adds no
// match-creation columns of its own.
//
// `is_open_for_challenge` mirrors the existing `is_open_for_players`
// column exactly (same shape of "discoverable" flag, added the same way
// in 20260827010000-phase1-backend-foundation.ts).
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('teams', 'is_open_for_challenge', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.createTable('team_challenges', {
      challenge_id: uuidPk(),
      challenging_team_id: uuid({ model: 'teams', key: 'team_id' }),
      challenged_team_id: uuid({ model: 'teams', key: 'team_id' }),
      status: {
        type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      initiated_by: uuid({ model: 'users', key: 'user_id' }),
      responded_by: uuid({ model: 'users', key: 'user_id' }, true),
      created_at: ts(),
      responded_at: ts(true),
    });
    await queryInterface.addIndex('team_challenges', ['challenged_team_id', 'status'], {
      name: 'ix_team_challenges_challenged_status',
    });
    await queryInterface.addIndex('team_challenges', ['challenging_team_id', 'status'], {
      name: 'ix_team_challenges_challenging_status',
    });

    await queryInterface.changeColumn('notifications', 'notification_type', {
      type: DataTypes.ENUM(...NOTIFICATION_TYPES),
      allowNull: false,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn('notifications', 'notification_type', {
      type: DataTypes.ENUM(
        ...NOTIFICATION_TYPES.filter(
          (t) => !['CHALLENGE_RECEIVED', 'CHALLENGE_ACCEPTED', 'CHALLENGE_DECLINED'].includes(t),
        ),
      ),
      allowNull: false,
    });
    await queryInterface.dropTable('team_challenges');
    await queryInterface.removeColumn('teams', 'is_open_for_challenge');
  },
};
