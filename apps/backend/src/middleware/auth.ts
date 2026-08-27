import { NextFunction, Request, Response } from 'express';
import { AuthTokenPayload, UserRole, verifyJwt } from '../services/authService';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function authenticateJwt(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: { message: 'Missing bearer token', status: 401 } });
  }

  try {
    req.auth = verifyJwt(token);
    return next();
  } catch {
    return res.status(401).json({ error: { message: 'Invalid bearer token', status: 401 } });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: { message: 'Authentication required', status: 401 } });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: { message: 'Role not permitted', status: 403 } });
    }
    return next();
  };
}
