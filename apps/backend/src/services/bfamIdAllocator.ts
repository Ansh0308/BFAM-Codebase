import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/sequelize';

export interface BfamIdStore {
  getCurrentNumber(): Promise<number | null>;
  persistAllocatedId(nextNumber: number): Promise<void>;
}

export const BFAM_ID_START = 1000;
const LOCK_NAME = 'bfam_id_allocator';

export function formatBfamId(number: number) {
  return `BF${number}`;
}

export async function allocateBfamIdFromStore(store: BfamIdStore) {
  const current = await store.getCurrentNumber();
  const next = current == null ? BFAM_ID_START : current + 1;
  await store.persistAllocatedId(next);
  return formatBfamId(next);
}

export class AtomicBfamIdAllocator {
  private chain = Promise.resolve();

  constructor(private readonly store: BfamIdStore) {}

  allocate() {
    const nextAllocation = this.chain.then(() => allocateBfamIdFromStore(this.store));
    this.chain = nextAllocation.then(
      () => undefined,
      () => undefined,
    );
    return nextAllocation;
  }
}

export async function allocateBfamId() {
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
      const next = current == null ? BFAM_ID_START : current + 1;
      return formatBfamId(next);
    });
  } finally {
    await sequelize.query('SELECT RELEASE_LOCK(:lockName)', {
      replacements: { lockName: LOCK_NAME },
      type: QueryTypes.SELECT,
    });
  }
}
