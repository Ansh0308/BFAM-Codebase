import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Smart Reminders (PRD §12.13): scheduled backend jobs, not client-side
// timers, at 24h/3h/1h/15min before a match's scheduled_start_time. The
// ticker (started from index.ts) calls sendMatchReminders() on an
// interval; this module's logic is deliberately pure/query-driven so it
// can be unit-tested without actually waiting real time.
export const REMINDER_THRESHOLD_MS: Record<string, number> = {
  '24H': 24 * 60 * 60 * 1000,
  '3H': 3 * 60 * 60 * 1000,
  '1H': 60 * 60 * 1000,
  '15MIN': 15 * 60 * 1000,
};

// Largest window first — if the ticker was down for a while, a match can
// legitimately owe more than one threshold at once; each is sent (and
// recorded) independently.
const THRESHOLDS_LARGEST_FIRST = ['24H', '3H', '1H', '15MIN'] as const;

interface UpcomingMatchRow {
  match_id: string;
  match_name: string | null;
  scheduled_start_time: Date;
}

export interface DueReminder {
  match_id: string;
  threshold: string;
  scheduled_start_time: Date;
}

// Pure-ish: given `now`, finds every (match, threshold) pair that is due
// and hasn't already been sent (per match_reminders_sent). Matches that
// have already started, or are cancelled, are never reminded.
export async function getDueReminders(now: Date): Promise<DueReminder[]> {
  const upcoming = await sequelize.query<UpcomingMatchRow>(
    `SELECT match_id, match_name, scheduled_start_time FROM matches
     WHERE match_status IN ('OPEN', 'PENDING', 'CONFIRMED') AND scheduled_start_time > :now`,
    { type: QueryTypes.SELECT, replacements: { now } },
  );
  if (upcoming.length === 0) return [];

  const alreadySent = await sequelize.query<{ match_id: string; threshold: string }>(
    `SELECT match_id, threshold FROM match_reminders_sent WHERE match_id IN (:matchIds)`,
    {
      type: QueryTypes.SELECT,
      replacements: { matchIds: upcoming.map((m) => m.match_id) },
    },
  );
  const sentKey = (matchId: string, threshold: string) => `${matchId}:${threshold}`;
  const sentSet = new Set(alreadySent.map((r) => sentKey(r.match_id, r.threshold)));

  const due: DueReminder[] = [];
  for (const match of upcoming) {
    const msUntilMatch = match.scheduled_start_time.getTime() - now.getTime();
    for (const threshold of THRESHOLDS_LARGEST_FIRST) {
      if (msUntilMatch > REMINDER_THRESHOLD_MS[threshold]) continue; // not due yet
      if (sentSet.has(sentKey(match.match_id, threshold))) continue; // already sent
      due.push({
        match_id: match.match_id,
        threshold,
        scheduled_start_time: match.scheduled_start_time,
      });
    }
  }
  return due;
}

const THRESHOLD_LABEL: Record<string, string> = {
  '24H': '24 hours',
  '3H': '3 hours',
  '1H': '1 hour',
  '15MIN': '15 minutes',
};

// Sends one notification per CONFIRMED roster player for each due
// reminder, then records it in match_reminders_sent so the same threshold
// is never sent twice for the same match — safe to call repeatedly (e.g.
// every 60s) without duplicating notifications.
export async function sendMatchReminders(now: Date = new Date()): Promise<number> {
  const due = await getDueReminders(now);
  let sentCount = 0;

  for (const reminder of due) {
    const [match] = await sequelize.query<{ match_name: string | null }>(
      'SELECT match_name FROM matches WHERE match_id = :matchId',
      { type: QueryTypes.SELECT, replacements: { matchId: reminder.match_id } },
    );
    const recipients = await sequelize.query<{ user_id: string }>(
      `SELECT p.user_id FROM match_players mp
       JOIN players p ON p.player_id = mp.player_id
       WHERE mp.match_id = :matchId AND mp.invitation_status = 'CONFIRMED'`,
      { type: QueryTypes.SELECT, replacements: { matchId: reminder.match_id } },
    );

    const title = 'Match reminder';
    const body = `${match?.match_name ?? 'Your match'} starts in ${THRESHOLD_LABEL[reminder.threshold]}.`;
    const createdAt = new Date();

    if (recipients.length > 0) {
      await sequelize.getQueryInterface().bulkInsert(
        'notifications',
        recipients.map((r) => ({
          notification_id: randomUUID(),
          user_id: r.user_id,
          notification_type: 'MATCH_REMINDER',
          title,
          body,
          related_entity_type: 'match',
          related_entity_id: reminder.match_id,
          delivery_channel: 'PUSH',
          delivery_status: 'PENDING',
          created_at: createdAt,
          read_at: null,
        })),
      );
    }

    // Idempotency guard: insert can race with a concurrent tick; a
    // duplicate-key error here just means another tick already recorded
    // it, which is fine — the notifications above may double-send in that
    // rare race, an acceptable MVP tradeoff over a full distributed lock.
    try {
      await sequelize.getQueryInterface().bulkInsert('match_reminders_sent', [
        {
          reminder_id: randomUUID(),
          match_id: reminder.match_id,
          threshold: reminder.threshold,
          sent_at: createdAt,
        },
      ]);
      sentCount += 1;
    } catch {
      // already recorded by a concurrent tick — not an error.
    }
  }

  return sentCount;
}

let tickerHandle: ReturnType<typeof setInterval> | null = null;

// Started once from index.ts (guarded to skip in tests, same pattern as
// migrations). 60s resolution is plenty for hour/day-scale thresholds.
export function startReminderTicker(intervalMs = 60_000) {
  if (tickerHandle) return;
  tickerHandle = setInterval(() => {
    sendMatchReminders().catch((error) => {
      console.error('[reminderService] Failed to send match reminders:', error);
    });
  }, intervalMs);
}

export function stopReminderTicker() {
  if (tickerHandle) clearInterval(tickerHandle);
  tickerHandle = null;
}
