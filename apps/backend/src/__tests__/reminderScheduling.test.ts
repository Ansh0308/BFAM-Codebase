// Tests for module 2.6's Smart Reminders (PRD §12.13): a real backend
// scheduled job (reminderService), not a client-side timer. Covers the
// threshold-selection logic (24h/3h/1h/15min), catch-up behavior when
// multiple thresholds are due at once, and idempotency (never re-sending
// an already-sent threshold, even across concurrent/repeated ticks).

interface MatchRow {
  match_id: string;
  match_name: string | null;
  match_status: string;
  scheduled_start_time: Date;
}
interface MatchPlayerRow {
  match_id: string;
  player_id: string;
  invitation_status: string;
}
interface PlayerRow {
  player_id: string;
  user_id: string;
}
interface ReminderSentRow {
  reminder_id: string;
  match_id: string;
  threshold: string;
  sent_at: Date;
}
interface NotificationRow {
  notification_id: string;
  user_id: string;
  notification_type: string;
  related_entity_id: string;
}

let matches: MatchRow[] = [];
let matchPlayers: MatchPlayerRow[] = [];
let players: PlayerRow[] = [];
let remindersSent: ReminderSentRow[] = [];
let notifications: NotificationRow[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('FROM matches') && sql.includes('scheduled_start_time > :now')) {
          const now = r.now as Date;
          return matches.filter(
            (m) =>
              ['OPEN', 'PENDING', 'CONFIRMED'].includes(m.match_status) &&
              m.scheduled_start_time.getTime() > now.getTime(),
          );
        }
        if (sql.includes('FROM match_reminders_sent WHERE match_id IN')) {
          const ids = r.matchIds as string[];
          return remindersSent.filter((row) => ids.includes(row.match_id));
        }
        if (sql.includes('SELECT match_name FROM matches WHERE match_id')) {
          const m = matches.find((x) => x.match_id === r.matchId);
          return m ? [{ match_name: m.match_name }] : [];
        }
        if (
          sql.includes('FROM match_players mp') &&
          sql.includes("invitation_status = 'CONFIRMED'")
        ) {
          const confirmedPlayerIds = matchPlayers
            .filter((mp) => mp.match_id === r.matchId && mp.invitation_status === 'CONFIRMED')
            .map((mp) => mp.player_id);
          return players
            .filter((p) => confirmedPlayerIds.includes(p.player_id))
            .map((p) => ({ user_id: p.user_id }));
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'notifications')
            notifications.push(...(rows as unknown as NotificationRow[]));
          if (table === 'match_reminders_sent') {
            for (const row of rows as unknown as ReminderSentRow[]) {
              if (
                remindersSent.some(
                  (x) => x.match_id === row.match_id && x.threshold === row.threshold,
                )
              ) {
                throw new Error('Duplicate entry for uk_match_reminders_sent_match_threshold');
              }
              remindersSent.push(row);
            }
          }
        },
      }),
    },
  };
});

import { getDueReminders, sendMatchReminders } from '../services/reminderService';

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe('Smart Reminders scheduling (module 2.6)', () => {
  beforeEach(() => {
    matches = [];
    matchPlayers = [];
    players = [{ player_id: 'player-1', user_id: 'user-1' }];
    remindersSent = [];
    notifications = [];
  });

  describe('getDueReminders', () => {
    it('selects the 24H threshold for a match starting in 23 hours (due, not yet sent)', async () => {
      const now = new Date('2026-09-10T00:00:00Z');
      matches = [
        {
          match_id: 'match-1',
          match_name: 'Test Match',
          match_status: 'OPEN',
          scheduled_start_time: new Date(now.getTime() + 23 * HOUR),
        },
      ];

      const due = await getDueReminders(now);
      expect(due).toEqual([
        {
          match_id: 'match-1',
          threshold: '24H',
          scheduled_start_time: matches[0].scheduled_start_time,
        },
      ]);
    });

    it('does not select any threshold for a match more than 24 hours away', async () => {
      const now = new Date('2026-09-10T00:00:00Z');
      matches = [
        {
          match_id: 'match-1',
          match_name: 'Test Match',
          match_status: 'OPEN',
          scheduled_start_time: new Date(now.getTime() + 25 * HOUR),
        },
      ];

      expect(await getDueReminders(now)).toEqual([]);
    });

    it('catches up on multiple missed thresholds at once if the ticker was down', async () => {
      const now = new Date('2026-09-10T00:00:00Z');
      matches = [
        {
          match_id: 'match-1',
          match_name: 'Test Match',
          match_status: 'OPEN',
          // 10 minutes away: 24H, 3H, 1H, and 15MIN are all overdue.
          scheduled_start_time: new Date(now.getTime() + 10 * MIN),
        },
      ];

      const due = await getDueReminders(now);
      const thresholds = due.map((d) => d.threshold).sort();
      expect(thresholds).toEqual(['15MIN', '1H', '24H', '3H'].sort());
    });

    it('never re-selects a threshold already recorded in match_reminders_sent', async () => {
      const now = new Date('2026-09-10T00:00:00Z');
      matches = [
        {
          match_id: 'match-1',
          match_name: 'Test Match',
          match_status: 'OPEN',
          scheduled_start_time: new Date(now.getTime() + 10 * MIN),
        },
      ];
      remindersSent = [
        { reminder_id: 'r1', match_id: 'match-1', threshold: '24H', sent_at: now },
        { reminder_id: 'r2', match_id: 'match-1', threshold: '3H', sent_at: now },
      ];

      const due = await getDueReminders(now);
      const thresholds = due.map((d) => d.threshold).sort();
      expect(thresholds).toEqual(['15MIN', '1H'].sort());
    });

    it('never reminds a match that has already started or passed', async () => {
      const now = new Date('2026-09-10T00:00:00Z');
      matches = [
        {
          match_id: 'match-1',
          match_name: 'Test Match',
          match_status: 'OPEN',
          scheduled_start_time: new Date(now.getTime() - 5 * MIN),
        },
      ];

      expect(await getDueReminders(now)).toEqual([]);
    });

    it('never reminds a cancelled match', async () => {
      const now = new Date('2026-09-10T00:00:00Z');
      matches = [
        {
          match_id: 'match-1',
          match_name: 'Test Match',
          match_status: 'CANCELLED',
          scheduled_start_time: new Date(now.getTime() + 30 * MIN),
        },
      ];

      expect(await getDueReminders(now)).toEqual([]);
    });
  });

  describe('sendMatchReminders', () => {
    it('notifies every CONFIRMED roster player and records the threshold as sent', async () => {
      const now = new Date('2026-09-10T00:00:00Z');
      matches = [
        {
          match_id: 'match-1',
          match_name: 'Test Match',
          match_status: 'OPEN',
          scheduled_start_time: new Date(now.getTime() + 23 * HOUR),
        },
      ];
      matchPlayers = [
        { match_id: 'match-1', player_id: 'player-1', invitation_status: 'CONFIRMED' },
      ];

      const sentCount = await sendMatchReminders(now);

      expect(sentCount).toBe(1);
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        user_id: 'user-1',
        notification_type: 'MATCH_REMINDER',
        related_entity_id: 'match-1',
      });
      expect(remindersSent).toHaveLength(1);
      expect(remindersSent[0]).toMatchObject({ match_id: 'match-1', threshold: '24H' });
    });

    it('does not notify a player whose invitation is only PENDING/MAYBE, not CONFIRMED', async () => {
      const now = new Date('2026-09-10T00:00:00Z');
      matches = [
        {
          match_id: 'match-1',
          match_name: 'Test Match',
          match_status: 'OPEN',
          scheduled_start_time: new Date(now.getTime() + 23 * HOUR),
        },
      ];
      matchPlayers = [{ match_id: 'match-1', player_id: 'player-1', invitation_status: 'MAYBE' }];

      await sendMatchReminders(now);

      expect(notifications).toHaveLength(0);
      // The threshold is still marked sent even with zero recipients — it
      // must not be retried forever just because nobody was confirmed yet.
      expect(remindersSent).toHaveLength(1);
    });

    it('is idempotent: calling it again for the same instant never duplicates a sent reminder', async () => {
      const now = new Date('2026-09-10T00:00:00Z');
      matches = [
        {
          match_id: 'match-1',
          match_name: 'Test Match',
          match_status: 'OPEN',
          scheduled_start_time: new Date(now.getTime() + 23 * HOUR),
        },
      ];
      matchPlayers = [
        { match_id: 'match-1', player_id: 'player-1', invitation_status: 'CONFIRMED' },
      ];

      const firstRun = await sendMatchReminders(now);
      const secondRun = await sendMatchReminders(now);

      expect(firstRun).toBe(1);
      expect(secondRun).toBe(0);
      expect(notifications).toHaveLength(1); // not 2
      expect(remindersSent).toHaveLength(1); // not 2
    });
  });
});
