import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Backlog B-8: lets a captain set a minimum Basic Skill Rating (module
// 2.10) required to join their team — enforced when a join request is
// made (teamService.requestToJoinTeam). Nullable/no default so every
// existing team is completely unaffected (no constraint = anyone can
// request, exactly today's behavior).
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('teams', 'min_skill_rating', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('teams', 'min_skill_rating');
  },
};
