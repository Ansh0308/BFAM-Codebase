import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { contactsLookupSchema } from '../validation/schemas';
import { matchContactsToPlayers } from '../services/contactsService';

const router = Router();

// POST /players/contacts-lookup (backlog B-2): given a batch of phone
// numbers from the caller's device contacts, returns only the ones that
// match a registered player — see contactsService.ts for the privacy
// rationale behind never echoing back non-matches. Auth-gated like every
// other endpoint here; there's no reason to widen this beyond a logged-in
// user, and doing so would only increase how much of the numbers-on-BFAM
// question a caller could probe anonymously.
router.post(
  '/contacts-lookup',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = contactsLookupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid contacts payload', status: 400 } });
    }
    const results = await matchContactsToPlayers(parsed.data.phone_numbers);
    return res.status(200).json({ results });
  }),
);

export default router;
