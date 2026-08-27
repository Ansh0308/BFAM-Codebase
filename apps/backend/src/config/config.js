require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'bfam_user',
    password: process.env.DB_PASSWORD || 'bfam_password',
    database: process.env.DB_NAME || 'bfam_dev',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
  },
  test: {
    username: process.env.DB_USER || 'bfam_user',
    password: process.env.DB_PASSWORD || 'bfam_password',
    database: process.env.DB_NAME || 'bfam_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
    logging: false,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
    logging: false,
  },
};
