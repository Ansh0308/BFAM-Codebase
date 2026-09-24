import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Long tail — Peak-viewer analytics (G-25), extending module 2.9's Live
// Match Viewer Count. The live/total viewer-count mechanism already works
// (presenceService.ts's Redis-backed active count + live_match_sessions
// for lifetime total), but nothing anywhere records a match's *peak*
// concurrent viewers — this was explicitly scoped as its own follow-up in
// the original build plan, separate from general Business Analytics.
//
// Same "cached running value" shape as players.skill_rating/coin_balance/
// xp_total elsewhere in this codebase: matches.peak_viewer_count only
// ever increases (per match), updated whenever the live active-viewer
// count is recomputed (see presenceService.ts's updatePeakViewerCount).
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('matches', 'peak_viewer_count', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('matches', 'peak_viewer_count');
  },
};
