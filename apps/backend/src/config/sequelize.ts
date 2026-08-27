import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbName = process.env.DB_NAME || 'bfam_dev';
const dbUser = process.env.DB_USER || 'bfam_user';
const dbPassword = process.env.DB_PASSWORD || 'bfam_password';

export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    // In CI or test environments, we may not run MySQL container, so don't fail immediately if in test env.
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}
