import { NextFunction, Request, Response } from 'express';

// Express 4 does not forward a rejected promise from an async route handler
// to the error-handling middleware automatically. Any error this module's
// routes don't map to a specific clean response (see routes/bookings.ts,
// routes/turfs.ts) must still reach app.ts's fallback handler instead of
// becoming an unhandled rejection — this wrapper is what makes that happen.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
