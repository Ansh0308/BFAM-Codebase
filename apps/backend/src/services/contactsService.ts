import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { normalizePhoneNumber, normalizePhoneNumbers } from '../domain/contacts';

export interface ContactMatch {
  /** The original phone number string the caller sent that matched. */
  phone_number: string;
  player_id: string;
  bfam_id: string;
  full_name: string | null;
}

interface RegisteredPlayerRow {
  phone_number: string;
  player_id: string;
  bfam_id: string;
  full_name: string | null;
}

// Contacts-Based Invites (backlog B-2): matches a batch of phone numbers
// (from the caller's device contacts) against registered PLAYER accounts.
// Privacy note (per the backlog's own callout): this only ever returns
// entries for numbers that ARE registered — a number with no match is
// simply absent from the response, never echoed back with a "not found"
// marker, so the response reveals nothing beyond "which of the numbers
// you already had is on BFAM". Deliberately PLAYER-only, same scope as the
// admin player directory — Turf Owner/Staff accounts aren't part of the
// social graph this is inviting into.
export async function matchContactsToPlayers(rawPhoneNumbers: string[]): Promise<ContactMatch[]> {
  const normalizedKeys = normalizePhoneNumbers(rawPhoneNumbers);
  if (normalizedKeys.size === 0) return [];

  // MySQL 8's REGEXP_REPLACE strips everything but digits from the stored
  // phone_number before taking the last 10 — the mirror of
  // normalizePhoneNumber() above, applied in SQL so the match happens in
  // one query rather than pulling every player row to compare in memory.
  const rows = await sequelize.query<RegisteredPlayerRow>(
    `SELECT u.phone_number, p.player_id, p.bfam_id, p.full_name
     FROM users u
     JOIN players p ON p.user_id = u.user_id
     WHERE u.role = 'PLAYER' AND u.deleted_at IS NULL
       AND RIGHT(REGEXP_REPLACE(u.phone_number, '[^0-9]', ''), 10) IN (:normalizedKeys)`,
    { type: QueryTypes.SELECT, replacements: { normalizedKeys: Array.from(normalizedKeys) } },
  );

  const byNormalizedKey = new Map<string, RegisteredPlayerRow>();
  for (const row of rows) {
    const key = normalizePhoneNumber(row.phone_number);
    if (key) byNormalizedKey.set(key, row);
  }

  const matches: ContactMatch[] = [];
  const seenPlayerIds = new Set<string>();
  for (const raw of rawPhoneNumbers) {
    const key = normalizePhoneNumber(raw);
    if (!key) continue;
    const row = byNormalizedKey.get(key);
    // A caller's contacts can list the same person's number more than
    // once (a duplicate contact, or several variantly-formatted entries
    // for one person) — only the first match is returned per player, so
    // the invite list never shows the same registered player twice.
    if (!row || seenPlayerIds.has(row.player_id)) continue;
    seenPlayerIds.add(row.player_id);
    matches.push({
      phone_number: raw,
      player_id: row.player_id,
      bfam_id: row.bfam_id,
      full_name: row.full_name,
    });
  }
  return matches;
}
