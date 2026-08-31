import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Adds real email verification (product request, 2026-08-30 — the user
// must prove they own an email address via OTP before it's saved to their
// profile, rather than just typing one in).
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.addColumn('users', 'email_verified_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });

    // otp_codes.purpose is a MySQL ENUM — widening it requires an explicit
    // column redefinition, not just a TypeScript union change.
    await queryInterface.changeColumn('otp_codes', 'purpose', {
      type: DataTypes.ENUM('SIGNUP', 'LOGIN', 'RESET_PASSWORD', 'EMAIL_VERIFY'),
      allowNull: false,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('users', 'email_verified_at');
    await queryInterface.changeColumn('otp_codes', 'purpose', {
      type: DataTypes.ENUM('SIGNUP', 'LOGIN', 'RESET_PASSWORD'),
      allowNull: false,
    });
  },
};
