// A database migrated in development (rows named "*.ts") must be recognised by
// the compiled production server (files named "*.js") and vice versa —
// otherwise the server tries to re-run every migration on boot.

import { ExtensionAgnosticStorage, normalizeMigrationName } from '../config/migrationStorage';

describe('normalizeMigrationName', () => {
  it('strips a .ts or .js extension and nothing else', () => {
    expect(normalizeMigrationName('20260910000000-turf-venues.ts')).toBe(
      '20260910000000-turf-venues',
    );
    expect(normalizeMigrationName('20260910000000-turf-venues.js')).toBe(
      '20260910000000-turf-venues',
    );
    expect(normalizeMigrationName('20260910000000-turf-venues')).toBe('20260910000000-turf-venues');
    expect(normalizeMigrationName('a.json-thing.js')).toBe('a.json-thing');
  });
});

function makeStorage(rows: string[], extension: string) {
  const created: string[] = [];
  const destroyedWhere: unknown[] = [];
  const model = {
    sequelize: { constructor: { DataTypes: { STRING: 'STRING' } } },
    sync: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn().mockImplementation(async () => rows.map((name) => ({ name }))),
    create: jest.fn().mockImplementation(async (row: { name: string }) => {
      created.push(row.name);
    }),
    destroy: jest.fn().mockImplementation(async (opts: unknown) => {
      destroyedWhere.push(opts);
    }),
  };
  const storage = new ExtensionAgnosticStorage({ model } as never, extension);
  return { storage, created, destroyedWhere };
}

describe('ExtensionAgnosticStorage', () => {
  it('reports rows written with either extension as the same executed migration', async () => {
    const { storage } = makeStorage(
      ['20260826000000-init-empty.ts', '20260827010000-phase1.js', '20260828000000-x'],
      '.js',
    );
    expect(await storage.executed()).toEqual([
      '20260826000000-init-empty',
      '20260827010000-phase1',
      '20260828000000-x',
    ]);
  });

  it('does not double-count a migration recorded under both extensions', async () => {
    const { storage } = makeStorage(['20260826000000-a.ts', '20260826000000-a.js'], '.js');
    expect(await storage.executed()).toEqual(['20260826000000-a']);
  });

  it('records new migrations with the extension of the running code', async () => {
    const compiled = makeStorage([], '.js');
    await compiled.storage.logMigration({ name: '20260901000000-b' });
    expect(compiled.created).toEqual(['20260901000000-b.js']);

    const fromSource = makeStorage([], '.ts');
    await fromSource.storage.logMigration({ name: '20260901000000-b' });
    expect(fromSource.created).toEqual(['20260901000000-b.ts']);
  });

  it('un-records a migration whichever extension its row was written with', async () => {
    const { storage, destroyedWhere } = makeStorage([], '.js');
    await storage.unlogMigration({ name: '20260901000000-b' });
    expect(destroyedWhere).toEqual([
      {
        where: {
          name: ['20260901000000-b', '20260901000000-b.ts', '20260901000000-b.js'],
        },
      },
    ]);
  });
});
