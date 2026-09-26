import { SequelizeStorage } from 'umzug';

// Migration history is kept in the SequelizeMeta table under each migration's
// file NAME. In development the backend runs straight from src/ (ts-node), so
// the names carry a `.ts` extension; a built deployment runs the compiled
// dist/ files, whose names end in `.js`. Compared literally, a database
// migrated in dev looked completely un-migrated to the compiled server, which
// then tried to re-run all 30 migrations and died on the first one
// ("Duplicate key name ..."). Migrations are identified here by their name
// WITHOUT the extension, and any existing row is honoured whichever extension
// it was written with.
const EXTENSION = /\.(?:ts|js)$/;

export function normalizeMigrationName(name: string): string {
  return name.replace(EXTENSION, '');
}

export class ExtensionAgnosticStorage extends SequelizeStorage {
  // `extension` is what new rows are written with — the extension of the code
  // that is running (".ts" from source, ".js" when compiled) — so sequelize-cli
  // (which always works from source) keeps seeing dev-applied rows as done.
  constructor(
    options: ConstructorParameters<typeof SequelizeStorage>[0],
    private readonly extension: string,
  ) {
    super(options);
  }

  async executed(): Promise<string[]> {
    const names = await super.executed();
    return [...new Set(names.map(normalizeMigrationName))];
  }

  async logMigration({ name }: { name: string }): Promise<void> {
    await super.logMigration({ name: `${normalizeMigrationName(name)}${this.extension}` });
  }

  async unlogMigration({ name }: { name: string }): Promise<void> {
    const base = normalizeMigrationName(name);
    await this.syncModel();
    await this.model.destroy({
      where: { [this.columnName]: [base, `${base}.ts`, `${base}.js`] },
    });
  }
}
