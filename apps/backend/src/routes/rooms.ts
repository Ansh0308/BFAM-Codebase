import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { assignRoomSidesSchema, convertRoomSchema, createRoomSchema } from '../validation/schemas';
import {
  assignRoomSides,
  convertRoomToMatch,
  createRoom,
  getRoomDetails,
  joinRoom,
  leaveRoom,
  listOpenRooms,
  randomSplitRoom,
} from '../services/roomService';
import {
  AlreadyInRoomError,
  ForbiddenActionError,
  InvalidRoomStateError,
  PlayerProfileNotFoundError,
  RoomFullError,
  RoomNotFoundError,
} from '../domain/errors';

const router = Router();

function handleRoomError(error: unknown, res: Response) {
  if (error instanceof RoomNotFoundError) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (error instanceof ForbiddenActionError) {
    return res.status(403).json({ error: { message: error.message, status: 403 } });
  }
  if (error instanceof PlayerProfileNotFoundError) {
    return res.status(422).json({ error: { message: error.message, status: 422 } });
  }
  if (
    error instanceof AlreadyInRoomError ||
    error instanceof InvalidRoomStateError ||
    error instanceof RoomFullError
  ) {
    return res.status(409).json({ error: { message: error.message, status: 409 } });
  }
  return null;
}

// POST /rooms — open a room (backlog B-11); creates it and makes the
// caller its captain atomically.
router.post(
  '/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid room payload', status: 400, details: parsed.error.flatten() },
      });
    }
    try {
      const room = await createRoom(req.auth!.sub, parsed.data);
      return res.status(201).json(room);
    } catch (error) {
      const handled = handleRoomError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /rooms/open — discovery surface for rooms still filling, parallel
// to GET /teams/open.
router.get(
  '/open',
  authenticateJwt,
  asyncHandler(async (_req: Request, res: Response) => {
    const rooms = await listOpenRooms();
    return res.status(200).json({ results: rooms });
  }),
);

// GET /rooms/:roomId — room details + player list.
router.get(
  '/:roomId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const room = await getRoomDetails(req.params.roomId);
      return res.status(200).json(room);
    } catch (error) {
      const handled = handleRoomError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /rooms/:roomId/join — join an open room.
router.post(
  '/:roomId/join',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const room = await joinRoom(req.params.roomId, req.auth!.sub);
      return res.status(200).json(room);
    } catch (error) {
      const handled = handleRoomError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /rooms/:roomId/leave — a member leaves; the captain leaving
// cancels the room outright (see roomService.leaveRoom).
router.post(
  '/:roomId/leave',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await leaveRoom(req.params.roomId, req.auth!.sub);
      return res.status(204).send();
    } catch (error) {
      const handled = handleRoomError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /rooms/:roomId/sides — captain-only manual side assignment,
// freely re-callable before the room converts (editable split).
router.post(
  '/:roomId/sides',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = assignRoomSidesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid side-assignment payload', status: 400 } });
    }
    try {
      const room = await assignRoomSides(req.params.roomId, req.auth!.sub, parsed.data.assignments);
      return res.status(200).json(room);
    } catch (error) {
      const handled = handleRoomError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /rooms/:roomId/sides/random — captain-only random shuffle into two
// roughly-even sides; still editable afterward via POST .../sides.
router.post(
  '/:roomId/sides/random',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const room = await randomSplitRoom(req.params.roomId, req.auth!.sub);
      return res.status(200).json(room);
    } catch (error) {
      const handled = handleRoomError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /rooms/:roomId/convert — captain-only: books the turf and converts
// the room into a real match (see roomService.convertRoomToMatch for the
// full hand-off to the existing Match Intro sequence).
router.post(
  '/:roomId/convert',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = convertRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid conversion payload', status: 400 } });
    }
    try {
      const result = await convertRoomToMatch(req.params.roomId, req.auth!.sub, {
        turfId: parsed.data.turf_id,
        bookingDate: parsed.data.booking_date,
        startTime: parsed.data.start_time,
        durationMinutes: parsed.data.duration_minutes,
        paymentMode: parsed.data.payment_mode,
      });
      return res.status(201).json(result);
    } catch (error) {
      const handled = handleRoomError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

export default router;
