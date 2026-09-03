import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { QueryTypes } from 'sequelize';
import type { Server, Socket } from 'socket.io';
import { sequelize } from '../config/sequelize';
import { matchRoom } from '../realtime/io';

// Module 2.9: Live Match Viewer Count (PRD §12.62).
//
// Active viewers are de-duplicated by (match_id, user_id) using a Redis
// sorted set per match — member = userId (or the socket id for an
// anonymous/unauthenticated viewer, so they still count individually),
// score = last-heartbeat epoch ms. A rejoin just refreshes the score
// (ZADD is idempotent on the member), so reconnects never double-count,
// and a dropped connection ages out of the TTL window on the next read
// instead of inflating the count forever.
//
// Total views (requirement 4) is a *different* number: every join is
// logged as its own row in live_match_sessions (already scaffolded in
// Phase 1), and total views is COUNT(*) of that table for the match —
// distinct sessions over the match's lifetime, not a live figure.
const PRESENCE_TTL_MS = 30_000;

let redisClient: Redis | null | undefined; // undefined = not yet attempted

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  try {
    const client = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't keep retrying forever — viewer count degrades to 0 instead of blocking anything
    });
    client.on('error', () => {
      // Swallow — presence is a nice-to-have; a Redis outage must never
      // take down match viewing itself.
    });
    redisClient = client;
    return client;
  } catch {
    redisClient = null;
    return null;
  }
}

function presenceKey(matchId: string) {
  return `presence:match:${matchId}`;
}

async function pruneStale(redis: Redis, matchId: string, now: number) {
  await redis.zremrangebyscore(presenceKey(matchId), '-inf', now - PRESENCE_TTL_MS);
}

export async function recordHeartbeat(matchId: string, viewerKey: string, now = Date.now()) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.connect().catch(() => {});
    await redis.zadd(presenceKey(matchId), now, viewerKey);
  } catch {
    // Redis unavailable — presence just won't update this tick.
  }
}

export async function recordLeave(matchId: string, viewerKey: string) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.zrem(presenceKey(matchId), viewerKey);
  } catch {
    // ignore
  }
}

export async function getActiveViewerCount(matchId: string, now = Date.now()): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    await redis.connect().catch(() => {});
    await pruneStale(redis, matchId, now);
    return await redis.zcard(presenceKey(matchId));
  } catch {
    return 0;
  }
}

export async function getTotalViews(matchId: string): Promise<number> {
  const [row] = await sequelize.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM live_match_sessions WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return Number(row?.count ?? 0);
}

async function logSession(matchId: string, userId: string | null, socketId: string) {
  const sessionId = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('live_match_sessions', [
    {
      viewer_session_id: sessionId,
      match_id: matchId,
      user_id: userId,
      socket_id: socketId,
      connected_at: new Date(),
      disconnected_at: null,
    },
  ]);
  return sessionId;
}

async function closeSession(sessionId: string) {
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'live_match_sessions',
      { disconnected_at: new Date() },
      { viewer_session_id: sessionId },
    );
}

async function broadcastViewerCount(io: Server, matchId: string) {
  const [active, total] = await Promise.all([
    getActiveViewerCount(matchId),
    getTotalViews(matchId),
  ]);
  io.to(matchRoom(matchId)).emit('match:viewer_count', { matchId, active, total });
}

// Registered per-socket from realtime/matchSocket.ts. `viewerKey` for
// de-duplication is the authenticated user_id when the client supplies
// one (trusted for counting purposes only — this is not an
// authorization check), falling back to the socket id so an anonymous
// viewer still counts as exactly one.
export function registerPresenceHandlers(io: Server, socket: Socket) {
  // Tracks both the live_match_sessions row id AND the exact Redis member
  // key (userId, or this socket's id for an anonymous viewer) used at
  // join/heartbeat time — `disconnect` fires with no event payload, so it
  // must reuse this rather than re-deriving a viewerKey from a userId that
  // socket.io no longer has, which would silently ZREM the wrong member
  // and leave an authenticated viewer's presence entry to only age out via
  // the 30s TTL instead of being removed immediately.
  const sessionsBySocketMatch = new Map<string, { sessionId: string; viewerKey: string }>();

  async function join(matchId: string, userId?: string) {
    if (!matchId) return;
    const viewerKey = userId ?? socket.id;
    socket.join(matchRoom(matchId));
    await recordHeartbeat(matchId, viewerKey);
    if (!sessionsBySocketMatch.has(matchId)) {
      const sessionId = await logSession(matchId, userId ?? null, socket.id);
      sessionsBySocketMatch.set(matchId, { sessionId, viewerKey });
    }
    await broadcastViewerCount(io, matchId);
  }

  async function leave(matchId: string, userId?: string) {
    if (!matchId) return;
    const tracked = sessionsBySocketMatch.get(matchId);
    const viewerKey = tracked?.viewerKey ?? userId ?? socket.id;
    await recordLeave(matchId, viewerKey);
    if (tracked) {
      await closeSession(tracked.sessionId);
      sessionsBySocketMatch.delete(matchId);
    }
    await broadcastViewerCount(io, matchId);
  }

  socket.on('join_match_viewer', ({ matchId, userId }: { matchId: string; userId?: string }) =>
    join(matchId, userId).catch(() => {}),
  );
  socket.on('heartbeat_match_viewer', ({ matchId, userId }: { matchId: string; userId?: string }) =>
    recordHeartbeat(matchId, userId ?? socket.id).catch(() => {}),
  );
  socket.on('leave_match_viewer', ({ matchId, userId }: { matchId: string; userId?: string }) =>
    leave(matchId, userId).catch(() => {}),
  );
  socket.on('disconnect', () => {
    for (const matchId of sessionsBySocketMatch.keys()) {
      leave(matchId).catch(() => {});
    }
  });
}
