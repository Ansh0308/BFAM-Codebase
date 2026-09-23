import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// A hardcoded default password would be a real vulnerability if someone
// forgot to set DB_PASSWORD in production — same reasoning as JWT_SECRET's
// fail-fast check in app.ts.
if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD must be set in production');
}

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbName = process.env.DB_NAME || 'bfam_dev';
const dbUser = process.env.DB_USER || 'bfam_user';
const dbPassword = process.env.DB_PASSWORD || 'bfam_password';

export interface MysqlTypeCastField {
  type: string;
  length: number;
  string: () => string | null;
}

// Every service in this codebase reads via raw sequelize.query, not
// Sequelize models — the model layer's own BOOLEAN-attribute casting never
// applies, so mysql2 hands back a DB BOOLEAN/TINYINT(1) column as a plain
// JS number (0/1). That silently round-trips as `1`/`0` wherever a
// raw-query result gets sent back to a route that validates the field with
// zod's strict `z.boolean()` (e.g. extras-setting's echo of
// `extras_count_toward_score`), producing a 400 "Invalid payload" that
// looks like a client bug but is really a driver-level type mismatch.
// Casting at the connection level (see `dialectOptions.typeCast` below)
// fixes it everywhere at once instead of `!!`-coercing each call site.
// Exported standalone so it's unit-testable without a live MySQL
// connection — this repo's test suite mocks sequelize.query throughout
// and has no CI database service, so a real-connection test isn't an
// option here.
export function boolTinyIntTypeCast(field: MysqlTypeCastField, next: () => unknown): unknown {
  if (field.type === 'TINY' && field.length === 1) {
    const value = field.string();
    return value === null ? null : value === '1';
  }
  return next();
}

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
  dialectOptions: {
    typeCast: boolTinyIntTypeCast,
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
