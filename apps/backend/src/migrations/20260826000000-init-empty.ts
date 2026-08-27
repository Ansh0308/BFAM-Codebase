import { QueryInterface } from 'sequelize';

module.exports = {
  up: async (_queryInterface: QueryInterface) => {
    // Empty migration scaffold for Phase 0 setup
    return Promise.resolve();
  },

  down: async (_queryInterface: QueryInterface) => {
    return Promise.resolve();
  },
};
