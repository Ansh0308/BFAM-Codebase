// Tests for module 2.9's Live Match Viewer Count (PRD §12.62): active
// viewers de-duplicated by (match_id, user_id) via a Redis presence set
// with heartbeat/TTL, and total views computed separately from
// live_match_sessions. A fake in-memory sorted set stands in for ioredis
// (no real Redis needed to run these), and a fake sequelize stands in for
// the live_match_sessions table — same pattern as this codebase's other
// service tests.

interface SessionRow {
  viewer_session_id: string;
  match_id: string;
  user_id: string | null;
  socket_id: string;
  connected_at: Date;
  disconnected_at: Date | null;
}

let sessions: SessionRow[] = [];

// A minimal in-memory stand-in for the handful of ioredis sorted-set
// commands presenceService actually uses.
class FakeRedis {
  private store = new Map<string, Map<string, number>>();

  async connect() {}
  on() {}

  async zadd(key: string, score: number, member: string) {
    const set = this.store.get(key) ?? new Map<string, number>();
    set.set(member, score);
    this.store.set(key, set);
  }

  async zrem(key: string, member: string) {
    this.store.get(key)?.delete(member);
  }

  async zremrangebyscore(key: string, _min: string, max: number) {
    const set = this.store.get(key);
    if (!set) return;
    for (const [member, score] of set) {
      if (score <= max) set.delete(member);
    }
  }

  async zcard(key: string) {
    return this.store.get(key)?.size ?? 0;
  }

  clear() {
    this.store.clear();
  }
}

const fakeRedisInstance = new FakeRedis();

// jest.fn() ignores an implementation's explicit return value when invoked
// with `new` (it constructs from the mock's own prototype instead), so a
// real class constructor is used here to get standard JS constructor-
// return semantics: `new MockRedis(...)` must yield fakeRedisInstance.
class MockRedis {
  constructor() {
    return fakeRedisInstance as unknown as MockRedis;
  }
}

jest.mock('ioredis', () => {
  return { __esModule: true, default: MockRedis };
});

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        if (sql.includes('COUNT(*) AS count FROM live_match_sessions')) {
          const matchId = options.replacements?.matchId;
          return [{ count: sessions.filter((s) => s.match_id === matchId).length }];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'live_match_sessions') sessions.push(...(rows as unknown as SessionRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'live_match_sessions') {
            const row = sessions.find((s) => s.viewer_session_id === where.viewer_session_id);
            if (row) Object.assign(row, values);
          }
        },
      }),
    },
  };
});

import {
  getActiveViewerCount,
  getTotalViews,
  recordHeartbeat,
  recordLeave,
} from '../services/presenceService';

const MATCH_ID = 'match-1';
const USER_ID = 'user-1';

describe('Live Match Viewer Count presence (module 2.9)', () => {
  beforeEach(() => {
    sessions = [];
    fakeRedisInstance.clear();
  });

  it('a single user connecting rapidly never counts as more than 1 active viewer', async () => {
    const now = Date.now();
    await recordHeartbeat(MATCH_ID, USER_ID, now);
    await recordHeartbeat(MATCH_ID, USER_ID, now + 10);
    await recordHeartbeat(MATCH_ID, USER_ID, now + 20);

    expect(await getActiveViewerCount(MATCH_ID, now + 30)).toBe(1);
  });

  it('reconnecting after a leave still counts as exactly 1, not 2', async () => {
    const now = Date.now();
    await recordHeartbeat(MATCH_ID, USER_ID, now);
    await recordLeave(MATCH_ID, USER_ID);
    await recordHeartbeat(MATCH_ID, USER_ID, now + 100); // reconnect

    expect(await getActiveViewerCount(MATCH_ID, now + 200)).toBe(1);
  });

  it('a dropped connection (no explicit leave) ages out of the active count once its TTL expires', async () => {
    const now = Date.now();
    await recordHeartbeat(MATCH_ID, USER_ID, now);

    expect(await getActiveViewerCount(MATCH_ID, now + 5_000)).toBe(1); // still fresh

    const THIRTY_ONE_SECONDS = 31_000;
    expect(await getActiveViewerCount(MATCH_ID, now + THIRTY_ONE_SECONDS)).toBe(0); // stale, pruned
  });

  it('two distinct users are counted separately', async () => {
    const now = Date.now();
    await recordHeartbeat(MATCH_ID, 'user-a', now);
    await recordHeartbeat(MATCH_ID, 'user-b', now);

    expect(await getActiveViewerCount(MATCH_ID, now + 10)).toBe(2);
  });

  describe('total views vs. active count', () => {
    it('logs one session row per join, so total views reflects lifetime history, not the live number', async () => {
      const now = new Date();
      sessions.push(
        {
          viewer_session_id: 's1',
          match_id: MATCH_ID,
          user_id: USER_ID,
          socket_id: 'sock-1',
          connected_at: now,
          disconnected_at: now,
        },
        {
          viewer_session_id: 's2',
          match_id: MATCH_ID,
          user_id: USER_ID,
          socket_id: 'sock-2',
          connected_at: now,
          disconnected_at: null,
        },
        {
          viewer_session_id: 's3',
          match_id: MATCH_ID,
          user_id: 'user-b',
          socket_id: 'sock-3',
          connected_at: now,
          disconnected_at: null,
        },
      );

      // Same user (USER_ID) reconnected — 2 sessions logged for them, but
      // active count for that user is still 1 (covered above). Total
      // views counts every session, including the two from the same user.
      expect(await getTotalViews(MATCH_ID)).toBe(3);

      const activeNow = Date.now();
      await recordHeartbeat(MATCH_ID, USER_ID, activeNow);
      expect(await getActiveViewerCount(MATCH_ID, activeNow + 10)).toBe(1);
    });
  });
});
