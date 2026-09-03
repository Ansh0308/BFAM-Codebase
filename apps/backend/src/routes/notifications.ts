import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../services/notificationService';
import { NOTIFICATION_PREFERENCE_CATEGORIES } from '../domain/constants';

const router = Router();

function isPreferenceCategory(
  value: unknown,
): value is (typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number] {
  return (NOTIFICATION_PREFERENCE_CATEGORIES as readonly string[]).includes(value as string);
}

// GET/PATCH /notifications/preferences — Notification Settings screen
// (module 2.2), now backed by real storage (module 2.11).
router.get(
  '/preferences',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const preferences = await getNotificationPreferences(req.auth!.sub);
    return res.status(200).json(preferences);
  }),
);

router.patch(
  '/preferences',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const updates: Partial<Record<(typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number], boolean>> =
      {};
    for (const category of NOTIFICATION_PREFERENCE_CATEGORIES) {
      if (typeof req.body?.[category] === 'boolean') updates[category] = req.body[category];
    }
    const preferences = await updateNotificationPreferences(req.auth!.sub, updates);
    return res.status(200).json(preferences);
  }),
);

// GET /notifications?filter=match_updates|booking_reminders|team_invites|
// promotions — Notification Center screen's filter tabs (module 2.11
// requirement 1); omitted filter returns everything.
router.get(
  '/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const filter = isPreferenceCategory(req.query.filter) ? req.query.filter : undefined;
    const notifications = await listNotifications(req.auth!.sub, filter);
    return res.status(200).json({ results: notifications });
  }),
);

router.post(
  '/:notificationId/read',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    await markNotificationRead(req.auth!.sub, req.params.notificationId);
    return res.status(204).send();
  }),
);

router.post(
  '/read-all',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    await markAllNotificationsRead(req.auth!.sub);
    return res.status(204).send();
  }),
);

export default router;
