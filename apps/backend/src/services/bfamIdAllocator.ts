import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/sequelize';

export const BFAM_ID_START = 1000;
const LOCK_NAME = 'bfam_id_allocator';

export function formatBfamId(number: number) {
  return `BF${number}`;
}

async function isBfamIdTaken(bfamId: string, transaction: Transaction): Promise<boolean> {
  const [existingUser] = await sequelize.query<{ user_id: string }>(
    'SELECT user_id FROM users WHERE bfam_id = :bfamId LIMIT 1',
    { type: QueryTypes.SELECT, transaction, replacements: { bfamId } },
  );
  if (existingUser) return true;

  const [reservation] = await sequelize.query<{ reservation_id: string }>(
    "SELECT reservation_id FROM reserved_bfam_ids WHERE bfam_id = :bfamId AND status IN ('LOCKED', 'ASSIGNED')",
    { type: QueryTypes.SELECT, transaction, replacements: { bfamId } },
  );
  return Boolean(reservation);
}

// How many jersey-ending candidates to try (e.g. for suffix "18": 1018,
// 1118, 1218, ...) before giving up and falling back to plain sequential
// allocation. Bounded so a suffix with unusually many collisions can't loop
// forever.
const JERSEY_CANDIDATE_ATTEMPTS = 200;

/**
 * Smallest BFAM ID number >= BFAM_ID_START whose decimal digits end with
 * `suffix` (e.g. suffix "18" -> 1018, suffix "7" -> 1007). Short admin-
 * premium IDs like "BF18" itself are deliberately out of this range — those
 * stay reserved for manual admin assignment (PRD §12.59 updated), this only
 * ever searches the normal >=1000 sequential space.
 */
function firstJerseyCandidate(suffix: string): number {
  const modBase = 10 ** suffix.length;
  const suffixNum = Number(suffix);
  let candidate = Math.floor(BFAM_ID_START / modBase) * modBase + suffixNum;
  if (candidate < BFAM_ID_START) candidate += modBase;
  return candidate;
}

/**
 * Atomically allocates the next BFAM ID and, while still holding the MySQL
 * named lock, invokes `insertRow` so the caller can insert the row that
 * consumes the ID (typically the new `users` row) inside the same
 * transaction. The lock is only released in the `finally` block AFTER that
 * transaction has committed (or rolled back), so no concurrent caller can
 * ever compute the same MAX(bfam_id) and allocate a duplicate ID.
 *
 * This replaces the previous implementation, which released the lock before
 * any caller had a chance to persist the allocated ID — leaving a window in
 * which two concurrent registrations could both compute the same next
 * number.
 *
 * `jerseyNumberSuffix` (product request, 2026-08-30): if the player's
 * favorite cricketer has a known jersey number, try to assign a BFAM ID
 * ending in it first (e.g. jersey 18 -> BF1018, or BF1118 if that's taken)
 * before falling back to plain sequential allocation. Note this makes the
 * sequential counter jump ahead by design — MAX(bfam_id) will include
 * whatever jersey-matched number got used, so the normal next-in-line ID
 * skips the gap left behind. That's an accepted tradeoff of the feature,
 * not a bug.
 */
export async function allocateBfamId<T>(
  insertRow: (bfamId: string, transaction: Transaction) => Promise<T>,
  jerseyNumberSuffix?: string | null,
): Promise<{ bfamId: string; result: T }> {
  const [{ locked }]: Array<{ locked: number }> = await sequelize.query(
    'SELECT GET_LOCK(:lockName, 10) AS locked',
    {
      replacements: { lockName: LOCK_NAME },
      type: QueryTypes.SELECT,
    },
  );

  if (locked !== 1) {
    throw new Error('Unable to acquire BFAM ID allocator lock');
  }

  try {
    return await sequelize.transaction(async (transaction: Transaction) => {
      if (jerseyNumberSuffix) {
        let candidate = firstJerseyCandidate(jerseyNumberSuffix);
        const modBase = 10 ** jerseyNumberSuffix.length;
        for (let attempts = 0; attempts < JERSEY_CANDIDATE_ATTEMPTS; attempts++) {
          const bfamId = formatBfamId(candidate);
          if (!(await isBfamIdTaken(bfamId, transaction))) {
            const result = await insertRow(bfamId, transaction);
            return { bfamId, result };
          }
          candidate += modBase;
        }
        // No free jersey-ending candidate within the bound — fall through
        // to plain sequential allocation below.
      }

      const rows = await sequelize.query<{ max_id: string | null }>(
        "SELECT MAX(CAST(SUBSTRING(bfam_id, 3) AS UNSIGNED)) AS max_id FROM users WHERE bfam_id LIKE 'BF%'",
        { type: QueryTypes.SELECT, transaction },
      );
      const current = rows[0]?.max_id == null ? null : Number(rows[0].max_id);
      let next = current == null ? BFAM_ID_START : current + 1;

      // Skip any number an admin has LOCKED for manual/premium assignment
      // (see reserved_bfam_ids — admin-lock feature, PRD §12.59 updated).
      // Bounded by a sane retry count so a pathological run of consecutive
      // locked IDs can't loop forever.
      for (let attempts = 0; attempts < 10_000; attempts++) {
        const [locked] = await sequelize.query<{ reservation_id: string }>(
          "SELECT reservation_id FROM reserved_bfam_ids WHERE bfam_id = :bfamId AND status = 'LOCKED'",
          { type: QueryTypes.SELECT, transaction, replacements: { bfamId: formatBfamId(next) } },
        );
        if (!locked) break;
        next++;
      }

      const bfamId = formatBfamId(next);

      const result = await insertRow(bfamId, transaction);

      return { bfamId, result };
    });
  } finally {
    await sequelize.query('SELECT RELEASE_LOCK(:lockName)', {
      replacements: { lockName: LOCK_NAME },
      type: QueryTypes.SELECT,
    });
  }
}
