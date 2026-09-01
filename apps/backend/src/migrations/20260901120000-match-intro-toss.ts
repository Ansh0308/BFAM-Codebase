import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

const uuid = (references?: { model: string; key: string }, allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references,
  onUpdate: 'CASCADE',
  onDelete: allowNull ? 'SET NULL' : 'RESTRICT',
});
const ts = (allowNull = false) => ({ type: DataTypes.DATE, allowNull });

// Module 2.7 (Countdown Intro, PRD §12.61): the toss result has nowhere to
// live in the Phase 1 schema — match_intro is the natural home (one row
// per match, exactly the "one-time sequence" this screen represents).
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn(
      'match_intro',
      'toss_winner_match_team_id',
      uuid({ model: 'match_teams', key: 'match_team_id' }, true),
    );
    await queryInterface.addColumn('match_intro', 'toss_decision', {
      type: DataTypes.ENUM('BAT', 'BOWL'),
      allowNull: true,
    });
    await queryInterface.addColumn('match_intro', 'toss_completed_at', ts(true));
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('match_intro', 'toss_completed_at');
    await queryInterface.removeColumn('match_intro', 'toss_decision');
    await queryInterface.removeColumn('match_intro', 'toss_winner_match_team_id');
  },
};
