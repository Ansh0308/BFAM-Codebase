import { AtomicBfamIdAllocator, BFAM_ID_START, BfamIdStore } from '../services/bfamIdAllocator';

class DelayedInMemoryStore implements BfamIdStore {
  private current: number | null = null;

  async getCurrentNumber() {
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 3)));
    return this.current;
  }

  async persistAllocatedId(nextNumber: number) {
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 3)));
    this.current = nextNumber;
  }
}

describe('AtomicBfamIdAllocator', () => {
  it('issues unique sequential BFAM IDs under concurrent allocation pressure', async () => {
    const allocator = new AtomicBfamIdAllocator(new DelayedInMemoryStore());
    const ids = await Promise.all(Array.from({ length: 100 }, () => allocator.allocate()));

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(`BF${BFAM_ID_START}`);
    expect(ids.at(-1)).toBe(`BF${BFAM_ID_START + ids.length - 1}`);
  });
});
