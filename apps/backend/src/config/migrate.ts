import path from 'path';
import { QueryInterface, Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from './sequelize';

type LegacyMigration = {
  up: (queryInterface: QueryInterface, sequelizeLib: typeof Sequelize) => Promise<unknown>;
  down: (queryInterface: QueryInterface, sequelizeLib: typeof Sequelize) => Promise<unknown>;
};

/**
 * Programmatic migration runner used at server boot so that connecting the
 * backend to a database is enough to bring it up to date — nobody has to
 * remember to run `db:migrate` by hand before/after a deploy.
 *
 * Points at the same migrations directory and uses the same `SequelizeMeta`
 * tracking table as `sequelize-cli` (see .sequelizerc / src/config/config.js),
 * so migrations applied via either path stay in sync and are never re-run.
 *
 * In dev (`ts-node-dev`) migrations run straight from src/migrations/*.ts.
 * In a built/production run (`npm run build` -> `dist/`), this same file is
 * compiled to dist/config/migrate.js and glob()s dist/migrations/*.js instead.
 */
// glob patterns use forward slashes even on Windows, where path.join()
// would otherwise produce backslashes that the glob matcher reads as escape
// characters (silently matching zero files instead of erroring).
const migrationsDir = path.join(__dirname, '..', 'migrations').split(path.sep).join('/');
const migrationsGlob = __filename.endsWith('.ts')
  ? `${migrationsDir}/*.ts`
  : `${migrationsDir}/*.js`;

export const umzug = new Umzug({
  migrations: {
    glob: migrationsGlob,
    // Existing migrations use sequelize-cli's legacy module shape
    // (`module.exports = { up(queryInterface, Sequelize), down(...) }`)
    // rather than Umzug's native `up({ context })` shape, so resolve them
    // by hand and adapt the call signature instead of rewriting every
    // migration file.
    resolve: ({ name, path: migrationPath, context }) => ({
      name,
      up: async () => {
        const migration = (await import(migrationPath!)) as LegacyMigration;
        return migration.up(context as QueryInterface, Sequelize);
      },
      down: async () => {
        const migration = (await import(migrationPath!)) as LegacyMigration;
        return migration.down(context as QueryInterface, Sequelize);
      },
    }),
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'SequelizeMeta' }),
  logger: console,
});

export async function runMigrations() {
  const pending = await umzug.pending();
  if (pending.length === 0) {
    console.log('Database schema is already up to date, no migrations to run.');
    return;
  }

  console.log(
    `Applying ${pending.length} pending migration(s): ${pending.map((m) => m.name).join(', ')}`,
  );
  await umzug.up();
  console.log('Database migrations applied successfully.');
}
