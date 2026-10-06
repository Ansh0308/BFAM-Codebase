import { NextFunction, Request, Response } from 'express';
import { MaintenanceModeError, assertBookingsOpen } from '../services/settingsService';

// While an admin has maintenance mode on, new bookings and new online payments
// are refused with a 503 and the admin's message; everything already booked and
// paid keeps working. Reads the (cached) setting; if the settings cannot be read
// the request goes through.
export async function blockDuringMaintenance(_req: Request, res: Response, next: NextFunction) {
  try {
    await assertBookingsOpen();
    return next();
  } catch (error) {
    if (error instanceof MaintenanceModeError) {
      return res
        .status(503)
        .json({ error: { message: error.message, status: 503, code: 'MAINTENANCE' } });
    }
    return next(error);
  }
}
