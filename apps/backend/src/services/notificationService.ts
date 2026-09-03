import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  NOTIFICATION_TEMPLATES,
  type NotificationEventType,
} from '../domain/notificationTemplates';
import { getRegisteredExpoPushTokens, sendExpoPushNotifications } from './pushNotificationService';

export interface NotificationPreferences {
  match_updates: boolean;
  booking_reminders: boolean;
  team_invites: boolean;
  promotions: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  match_updates: true,
  booking_reminders: true,
  team_invites: true,
  promotions: false,
};

// Notification Settings (module 2.2) persistence — the Phase 1 schema had
// nowhere to store these toggles, so notification_preferences (added by
// this module's migration) is new. A user with no row yet simply gets the
// same defaults the table declares.
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const [row] = await sequelize.query<NotificationPreferences>(
    'SELECT match_updates, booking_reminders, team_invites, promotions FROM notification_preferences WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  return row ?? DEFAULT_PREFERENCES;
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const next = { ...current, ...updates };
  const now = new Date();

  const [existing] = await sequelize.query<{ user_id: string }>(
    'SELECT user_id FROM notification_preferences WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );

  if (existing) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate('notification_preferences', { ...next, updated_at: now }, { user_id: userId });
  } else {
    await sequelize
      .getQueryInterface()
      .bulkInsert('notification_preferences', [
        { user_id: userId, ...next, created_at: now, updated_at: now },
      ]);
  }

  return next;
}

export interface SendNotificationInput<Params = Record<string, string>> {
  userId: string;
  event: NotificationEventType;
  params: Params;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

// The single funnel every module's event goes through (module 2.11, PRD
// §12.45 requirement 2). Never throws — a notification is a side-effect of
// the real operation (a booking, an invite, a finalized match), and a
// failure to notify must never fail that operation itself. Logs and
// swallows instead.
export async function sendNotification<Params = Record<string, string>>(
  input: SendNotificationInput<Params>,
): Promise<{ notification_id: string | null; pushed: boolean }> {
  try {
    return await sendNotificationUnsafe(input);
  } catch (error) {
    console.error(`[notificationService] Failed to send ${input.event} to ${input.userId}:`, error);
    return { notification_id: null, pushed: false };
  }
}

// Always writes the notifications row first — that row is the in-app
// Notification Center log and must exist "even if the backend event still
// fires for logging" (requirement 3) regardless of preference — then only
// attempts an actual push when the event's category is enabled for this
// user.
async function sendNotificationUnsafe<Params = Record<string, string>>(
  input: SendNotificationInput<Params>,
): Promise<{ notification_id: string; pushed: boolean }> {
  const template = NOTIFICATION_TEMPLATES[input.event];
  const title = template.title(input.params);
  const body = template.body(input.params);

  const notificationId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('notifications', [
    {
      notification_id: notificationId,
      user_id: input.userId,
      notification_type: input.event,
      title,
      body,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      delivery_channel: 'PUSH',
      delivery_status: 'PENDING',
      created_at: now,
      read_at: null,
    },
  ]);

  const preferences = await getNotificationPreferences(input.userId);
  const categoryEnabled = preferences[template.category];
  if (!categoryEnabled) {
    return { notification_id: notificationId, pushed: false };
  }

  const tokens = getRegisteredExpoPushTokens(input.userId);
  const pushed = await sendExpoPushNotifications(tokens, title, body, {
    event: input.event,
    related_entity_type: input.relatedEntityType,
    related_entity_id: input.relatedEntityId,
  });
  if (pushed) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'notifications',
        { delivery_status: 'DELIVERED' },
        { notification_id: notificationId },
      );
  }

  return { notification_id: notificationId, pushed };
}

// Convenience for fan-out to a whole roster (invites, match starting,
// match result) — each recipient's own preferences are still checked
// individually.
export async function sendNotificationToMany<Params = Record<string, string>>(
  userIds: string[],
  event: NotificationEventType,
  params: Params,
  relatedEntityType?: string | null,
  relatedEntityId?: string | null,
) {
  await Promise.all(
    userIds.map((userId) =>
      sendNotification({ userId, event, params, relatedEntityType, relatedEntityId }),
    ),
  );
}

export interface NotificationRow {
  notification_id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  delivery_channel: string;
  delivery_status: string;
  created_at: Date;
  read_at: Date | null;
}

// Notification Center screen (module 2.11 requirement 1): `filter` mirrors
// the four preference categories so the UI's filter tabs can query by the
// same grouping the settings screen already uses.
export async function listNotifications(
  userId: string,
  filter?: 'match_updates' | 'booking_reminders' | 'team_invites' | 'promotions',
): Promise<NotificationRow[]> {
  if (!filter) {
    return sequelize.query<NotificationRow>(
      'SELECT * FROM notifications WHERE user_id = :userId ORDER BY created_at DESC',
      { type: QueryTypes.SELECT, replacements: { userId } },
    );
  }

  const typesInCategory = (Object.keys(NOTIFICATION_TEMPLATES) as NotificationEventType[]).filter(
    (type) => NOTIFICATION_TEMPLATES[type].category === filter,
  );
  return sequelize.query<NotificationRow>(
    'SELECT * FROM notifications WHERE user_id = :userId AND notification_type IN (:types) ORDER BY created_at DESC',
    { type: QueryTypes.SELECT, replacements: { userId, types: typesInCategory } },
  );
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'notifications',
      { delivery_status: 'READ', read_at: new Date() },
      { notification_id: notificationId, user_id: userId },
    );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'notifications',
      { delivery_status: 'READ', read_at: new Date() },
      { user_id: userId, read_at: null },
    );
}
