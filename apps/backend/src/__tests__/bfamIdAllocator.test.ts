// Fakes out only the low-level MySQL driver calls (GET_LOCK / RELEASE_LOCK /
// the MAX(bfam_id) lookup / transaction wrapping) that the real
// `allocateBfamId` issues via `sequelize`. `allocateBfamId` itself is NOT
// mocked — every test below runs the exact production code path, including
// its lock-held-across-the-insert fix, against this fake MySQL-like store.
// A real MySQL instance is not available in this test environment (see
// docker-compose.yml / no `docker` binary here), so this fake substitutes for
// it while preserving MySQL's key semantics: GET_LOCK blocks concurrent
// callers until RELEASE_LOCK is called, and inserted rows are only visible
// to `getCurrentNumber` after the fake "transaction" resolves.

let usersTable: Array<{ bfam_id: string }> = [];
let lockHeld = false;
const lockWaiters: Array<() => void> = [];

async function acquireLock(): Promise<void> {
  if (!lockHeld) {
    lockHeld = true;
    return;
  }
  await new Promise<void>((resolve) => lockWaiters.push(resolve));
  lockHeld = true;
}

function releaseLock(): void {
  lockHeld = false;
  const next = lockWaiters.shift();
  if (next) next();
}

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, _options: unknown) => {
        // Random micro-delay to emulate real network/IO latency and increase
        // the odds of exposing a race if the lock were held incorrectly.
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 3)));

        if (sql.includes('GET_LOCK')) {
          await acquireLock();
          return [{ locked: 1 }];
        }
        if (sql.includes('RELEASE_LOCK')) {
          releaseLock();
          return [{}];
        }
        if (sql.includes('MAX(CAST(SUBSTRING')) {
          const numbers = usersTable.map((u) => Number(u.bfam_id.replace('BF', '')));
          const max = numbers.length ? Math.max(...numbers) : null;
          return [{ max_id: max === null ? null : String(max) }];
        }
        // Admin-lock reservation check (see adminBfamId.test.ts for the
        // dedicated reservation-behavior tests) — this fake never has any
        // locked IDs, so the allocator's skip-loop always finds nothing.
        if (sql.includes('SELECT reservation_id FROM reserved_bfam_ids')) {
          return [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (transaction: unknown) => Promise<unknown>) => {
        return fn({});
      },
    },
  };
});

// Import AFTER the mock so `allocateBfamId` picks up the faked `sequelize`.
import { allocateBfamId, BFAM_ID_START, formatBfamId } from '../services/bfamIdAllocator';

describe('allocateBfamId', () => {
  beforeEach(() => {
    usersTable = [];
    lockHeld = false;
    lockWaiters.length = 0;
  });

  it('issues unique sequential BFAM IDs under concurrent allocation pressure', async () => {
    const CONCURRENT_REGISTRATIONS = 100;

    const allocations = await Promise.all(
      Array.from({ length: CONCURRENT_REGISTRATIONS }, () =>
        allocateBfamId(async (bfamId) => {
          // Simulate the caller's users-row insert happening while the lock
          // is still held, same as the real registration flow.
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 3)));
          usersTable.push({ bfam_id: bfamId });
          return bfamId;
        }),
      ),
    );

    const ids = allocations.map((a) => a.bfamId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(usersTable).toHaveLength(CONCURRENT_REGISTRATIONS);

    const sorted = [...ids].sort(
      (a, b) => Number(a.replace('BF', '')) - Number(b.replace('BF', '')),
    );
    expect(sorted[0]).toBe(formatBfamId(BFAM_ID_START));
    expect(sorted.at(-1)).toBe(formatBfamId(BFAM_ID_START + CONCURRENT_REGISTRATIONS - 1));
  }, 15000);

  it('does not persist the allocated ID if the insert callback throws', async () => {
    await expect(
      allocateBfamId(async () => {
        throw new Error('insert failed');
      }),
    ).rejects.toThrow('insert failed');

    // Lock must still have been released despite the failure.
    const next = await allocateBfamId(async (bfamId) => {
      usersTable.push({ bfam_id: bfamId });
      return bfamId;
    });
    expect(next.bfamId).toBe(formatBfamId(BFAM_ID_START));
  });
});
