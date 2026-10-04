import { NextFunction, Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { AuthTokenPayload, UserRole, verifyJwt } from '../services/authService';
import { writeAuditLog } from '../services/auditLogService';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
      // Set when an ADMIN is acting as a turf owner / staff member (see
      // allowAdminActAs): the admin's own user id.
      actingAdminId?: string;
      // Raw request bytes, captured by app.ts's express.json({ verify })
      // hook — needed to verify the Razorpay webhook's HMAC signature.
      rawBody?: Buffer;
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

// Lets an ADMIN use the Turf Owner / Turf Staff portals on someone's behalf:
// send `X-Act-As-User: <user id>` and the request is handled exactly as if
// that owner/staff member had made it (so every owner screen — pricing,
// hours, availability, staff, venues — works for the admin without a second
// copy of the code). Ignored for everyone who isn't an ADMIN. Writes are
// recorded in the audit log under the admin's own id. Mount it between
// authenticateJwt and requireRoles on the /owner and /staff routers only.
export async function allowAdminActAs(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers['x-act-as-user'];
  const targetId = typeof raw === 'string' ? raw.trim() : '';
  if (!req.auth || req.auth.role !== 'ADMIN' || !targetId) return next();

  try {
    const [target] = await sequelize.query<{ user_id: string; role: UserRole }>(
      `SELECT user_id, role FROM users
       WHERE user_id = :targetId AND role IN ('TURF_OWNER', 'TURF_STAFF')
         AND deleted_at IS NULL`,
      { type: QueryTypes.SELECT, replacements: { targetId } },
    );
    if (!target) {
      return res
        .status(404)
        .json({ error: { message: 'That owner or staff account was not found.', status: 404 } });
    }

    const adminId = req.auth.sub;
    req.actingAdminId = adminId;
    req.auth = { ...req.auth, sub: target.user_id, role: target.role, bfam_id: null };

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      await writeAuditLog({
        actorUserId: adminId,
        actorRole: 'ADMIN',
        action: 'ADMIN_ACTED_AS',
        resourceType: 'user',
        resourceId: target.user_id,
        afterData: { method: req.method, path: req.originalUrl.split('?')[0] },
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
