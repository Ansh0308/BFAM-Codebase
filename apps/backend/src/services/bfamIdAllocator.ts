import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/sequelize';

export const BFAM_ID_START = 1000;
const LOCK_NAME = 'bfam_id_allocator';

export function formatBfamId(number: number) {
  return `BF${number}`;
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
 */
export async function allocateBfamId<T>(
  insertRow: (bfamId: string, transaction: Transaction) => Promise<T>,
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
