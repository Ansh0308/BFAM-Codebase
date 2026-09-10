// Backlog B-2: matching a batch of phone numbers (from a player's device
// contacts) against registered accounts. Pure normalization logic only —
// no DB access — so the matching rule is unit-testable independent of the
// query that uses it.
//
// BFAM is single-country (India) today: every stored phone_number is
// entered with a country code (e.g. "+919876543210"), but a phone's local
// contacts can have almost any formatting a person or their contacts app
// chooses to store — spaces, dashes, parentheses, a leading "0", a missing
// or different-looking country code prefix, etc. Comparing the last 10
// digits (India's national significant number length) sidesteps most of
// that formatting variance without needing a full phone-number-parsing
// library for a single-country MVP.
const NATIONAL_NUMBER_LENGTH = 10;

// Returns the 10-digit normalized key used for matching, or null if the
// input doesn't have enough digits to be a real phone number (so it's
// simply skipped rather than colliding with a short/garbage entry).
export function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < NATIONAL_NUMBER_LENGTH) return null;
  return digits.slice(-NATIONAL_NUMBER_LENGTH);
}

// De-duplicates a raw contacts-list phone number batch down to the set of
// valid normalized keys to actually query for — callers still need the
// original strings to map results back to specific contact entries.
export function normalizePhoneNumbers(rawNumbers: string[]): Set<string> {
  const keys = new Set<string>();
  for (const raw of rawNumbers) {
    const key = normalizePhoneNumber(raw);
    if (key) keys.add(key);
  }
  return keys;
}
