import { randomUUID } from 'crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { CONSENT_TYPES } from '../domain/constants';

export type ConsentType = (typeof CONSENT_TYPES)[number];

// Backlog G-21 (PRD §32.8): one shared version for the whole Terms &
// Privacy document — see the migration for why this isn't versioned
// per-category. Bump this string whenever that document changes; every
// consent recorded afterward stamps the new version, and every consent
// recorded before it keeps whatever version was current at the time (the
// log is append-only, never rewritten).
export const CURRENT_POLICY_VERSION = '2026-09-24';

export interface ConsentRow {
  consent_id: string;
  user_id: string;
  consent_type: ConsentType;
  policy_version: string;
  accepted_at: Date;
  created_at: Date;
}

export async function recordConsent(
  userId: string,
  consentType: ConsentType,
  acceptedAt: Date = new Date(),
  transaction?: Transaction,
): Promise<void> {
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert(
    'user_consents',
    [
      {
        consent_id: randomUUID(),
        user_id: userId,
        consent_type: consentType,
        policy_version: CURRENT_POLICY_VERSION,
        accepted_at: acceptedAt,
        created_at: now,
      },
    ],
    transaction ? { transaction } : undefined,
  );
}

// Every consent row for this user, most recent first — a category's
// "current" status is just its first entry in this list, since the log is
// append-only and never rewritten in place.
export async function getMyConsents(userId: string): Promise<ConsentRow[]> {
  return sequelize.query<ConsentRow>(
    'SELECT * FROM user_consents WHERE user_id = :userId ORDER BY accepted_at DESC',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
}
