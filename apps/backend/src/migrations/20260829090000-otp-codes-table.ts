import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

// Moves OTP state out of the in-memory Map (otpService.ts's original
// implementation) into MySQL — required for production: an in-memory Map is
// wiped on every restart/deploy and doesn't work once more than one backend
// instance is running. No `otp_codes` table exists in the DB doc yet
// because OTP delivery itself was explicitly out of scope until now.
module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: Sequelize) => {
    await queryInterface.createTable('otp_codes', {
      otp_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      identifier: { type: DataTypes.STRING(255), allowNull: false },
      purpose: {
        type: DataTypes.ENUM('SIGNUP', 'LOGIN', 'RESET_PASSWORD'),
        allowNull: false,
      },
      code_hash: { type: DataTypes.STRING(255), allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      consumed_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('otp_codes', ['identifier', 'purpose'], {
      name: 'idx_otp_codes_identifier_purpose',
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('otp_codes');
  },
};
