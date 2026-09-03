import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { sendNotificationToMany, sendNotification } from './notificationService';

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

    const createdAt = new Date();

    // Routed through notificationService (module 2.11) so Notification
    // Settings preferences apply here too — this was previously a direct
    // bulkInsert that bypassed preference-checking entirely.
    if (recipients.length > 0) {
      await sendNotificationToMany(
        recipients.map((r) => r.user_id),
        'MATCH_REMINDER',
        {
          matchName: match?.match_name ?? 'Your match',
          timeUntil: THRESHOLD_LABEL[reminder.threshold],
        },
        'match',
        reminder.match_id,
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

// PAYMENT_REMINDER (module 2.11, PRD §12.45): any still-unpaid obligation
// on a future, non-cancelled booking that hasn't already gotten one — the
// NOT EXISTS guard is what makes this safe to call on every ticker tick
// without re-sending the same reminder.
export async function sendPaymentReminders(now: Date = new Date()): Promise<number> {
  const pendingObligations = await sequelize.query<{
    obligation_id: string;
    player_id: string | null;
    booked_by: string;
    amount_due: number;
    match_name: string | null;
  }>(
    `SELECT o.obligation_id, o.player_id, b.booked_by, o.amount_due, m.match_name
     FROM payment_obligations o
     JOIN bookings b ON b.booking_id = o.booking_id
     LEFT JOIN matches m ON m.booking_id = b.booking_id
     WHERE o.due_status IN ('PENDING', 'PARTIALLY_PAID')
       AND b.booking_status != 'CANCELLED'
       AND b.booking_date >= :today
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.notification_type = 'PAYMENT_REMINDER' AND n.related_entity_id = o.obligation_id
       )`,
    { type: QueryTypes.SELECT, replacements: { today: now.toISOString().slice(0, 10) } },
  );

  let sentCount = 0;
  for (const obligation of pendingObligations) {
    let userId = obligation.booked_by;
    // A per-player split-payment share is owed by that specific player,
    // not necessarily the person who made the booking.
    if (obligation.player_id) {
      const [player] = await sequelize.query<{ user_id: string }>(
        'SELECT user_id FROM players WHERE player_id = :playerId',
        { type: QueryTypes.SELECT, replacements: { playerId: obligation.player_id } },
      );
      if (!player) continue;
      userId = player.user_id;
    }

    await sendNotification({
      userId,
      event: 'PAYMENT_REMINDER',
      params: {
        matchName: obligation.match_name ?? 'your booking',
        amountDue: String(obligation.amount_due),
      },
      relatedEntityType: 'obligation',
      relatedEntityId: obligation.obligation_id,
    });
    sentCount += 1;
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
    sendPaymentReminders().catch((error) => {
      console.error('[reminderService] Failed to send payment reminders:', error);
    });
  }, intervalMs);
}

export function stopReminderTicker() {
  if (tickerHandle) clearInterval(tickerHandle);
  tickerHandle = null;
}
