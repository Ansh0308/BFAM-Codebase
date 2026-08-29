import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { USER_ROLES } from '../domain/constants';

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  // Only PLAYER accounts have one (PRD §12.59, updated) — TURF_OWNER/
  // TURF_STAFF/ADMIN carry bfam_id: null.
  bfam_id: string | null;
  scopes: string[];
}

export const ROLE_SCOPES: Record<UserRole, string[]> = {
  PLAYER: ['profile:read', 'profile:write', 'bookings:create', 'matches:create', 'payments:create'],
  TURF_OWNER: [
    'turfs:manage',
    'pricing:manage',
    'bookings:manage',
    'staff:manage',
    'matches:score',
  ],
  TURF_STAFF: ['bookings:today', 'checkins:manage', 'matches:score', 'turfs:status'],
  ADMIN: ['platform:manage', 'users:manage', 'turfs:manage', 'payments:manage', 'support:manage'],
};

const defaultSecret = 'bfam-phase1-local-secret';

export function issueJwt(input: { userId?: string; role: UserRole; bfamId?: string | null }) {
  const payload: AuthTokenPayload = {
    sub: input.userId ?? randomUUID(),
    role: input.role,
    bfam_id: input.bfamId ?? null,
    scopes: ROLE_SCOPES[input.role],
  };

  return jwt.sign(payload, process.env.JWT_SECRET || defaultSecret, { expiresIn: '1h' });
}

export function verifyJwt(token: string) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET || defaultSecret) as AuthTokenPayload;
  if (!USER_ROLES.includes(decoded.role)) {
    throw new Error('Invalid JWT role');
  }
  return decoded;
}
