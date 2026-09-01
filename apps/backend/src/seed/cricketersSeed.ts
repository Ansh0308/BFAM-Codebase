// Imports Cricsheet's openly-licensed player registry (Open Data Commons
// Attribution License — https://cricsheet.org/register/) into the local
// `cricketers` table, then applies the small curated jersey-number overlay
// on top (see data/curated-jersey-numbers.json). Idempotent: safe to re-run
// — existing rows are updated in place by external_id rather than
// duplicated.
//
// Run with: npm run db:seed:cricketers --workspace=apps/backend

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

const PEOPLE_CSV_PATH = path.join(__dirname, 'data', 'cricsheet-people.csv');
const JERSEY_JSON_PATH = path.join(__dirname, 'data', 'curated-jersey-numbers.json');

interface CuratedEntry {
  cricsheet_id: string;
  display_name: string;
  jersey_number: string;
}

function parsePeopleCsv(): Array<{ identifier: string; name: string }> {
  const raw = fs.readFileSync(PEOPLE_CSV_PATH, 'utf-8');
  const lines = raw.split('\n').filter((line) => line.trim().length > 0);
  // First line is the header (identifier,name,unique_name,key_bcci,...) —
  // only the first two columns are used here.
  return lines.slice(1).map((line) => {
    const [identifier, name] = line.split(',');
    return { identifier, name };
  });
}

async function main() {
  await sequelize.authenticate();

  const people = parsePeopleCsv();
  const curated: CuratedEntry[] = JSON.parse(fs.readFileSync(JERSEY_JSON_PATH, 'utf-8')).entries;
  const curatedById = new Map(curated.map((entry) => [entry.cricsheet_id, entry]));

  const now = new Date();
  const BATCH_SIZE = 500;
  let imported = 0;

  for (let i = 0; i < people.length; i += BATCH_SIZE) {
    const batch = people.slice(i, i + BATCH_SIZE);
    const rows = batch.map(({ identifier, name }) => {
      const override = curatedById.get(identifier);
      return {
        cricketer_id: randomUUID(),
        source: 'cricsheet',
        source_id: identifier,
        external_id: `cricsheet-${identifier}`,
        name,
        display_name: override?.display_name ?? name,
        jersey_number: override?.jersey_number ?? null,
        created_at: now,
        updated_at: now,
      };
    });

    // Idempotent upsert by external_id, one row at a time — 18k rows at
    // this size is still fast (a few seconds), and it keeps the query
    // simple/correct rather than hand-building a parameterized bulk upsert.
    for (const row of rows) {
      await sequelize.query(
        `INSERT INTO cricketers (cricketer_id, source, source_id, external_id, name, display_name, jersey_number, created_at, updated_at)
         VALUES (:cricketer_id, :source, :source_id, :external_id, :name, :display_name, :jersey_number, :created_at, :updated_at)
         ON DUPLICATE KEY UPDATE name = :name, display_name = :display_name, jersey_number = :jersey_number, updated_at = :updated_at`,
        { replacements: row, type: QueryTypes.INSERT },
      );
    }

    imported = Math.min(i + BATCH_SIZE, people.length);
    console.log(`Seeded ${imported}/${people.length} cricketers...`);
  }

  console.log(
    `Done. ${imported} cricketers imported, ${curated.length} with a curated jersey number.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('Cricketers seed failed:', error);
  process.exit(1);
});
