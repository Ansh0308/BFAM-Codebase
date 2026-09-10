// Unit tests for backlog B-2's phone-number normalization (domain/
// contacts.ts) — the matching rule that lets a device contact like
// "(987) 654-3210" or "091-9876543210" match a stored "+919876543210"
// without a full phone-parsing library.

import { normalizePhoneNumber, normalizePhoneNumbers } from '../domain/contacts';

describe('normalizePhoneNumber', () => {
  it('extracts the last 10 digits regardless of formatting', () => {
    expect(normalizePhoneNumber('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhoneNumber('(987) 654-3210')).toBe('9876543210');
    expect(normalizePhoneNumber('919876543210')).toBe('9876543210');
    expect(normalizePhoneNumber('09876543210')).toBe('9876543210');
  });

  it('two numbers that differ only in country-code formatting normalize to the same key', () => {
    expect(normalizePhoneNumber('+919876543210')).toBe(normalizePhoneNumber('9876543210'));
  });

  it('returns null for anything with fewer than 10 digits — not a real phone number', () => {
    expect(normalizePhoneNumber('12345')).toBeNull();
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber('abc-def')).toBeNull();
  });
});

describe('normalizePhoneNumbers', () => {
  it('de-duplicates and drops invalid entries', () => {
    const keys = normalizePhoneNumbers(['+919876543210', '9876543210', 'not-a-number', '1234']);
    expect(keys.size).toBe(1);
    expect(keys.has('9876543210')).toBe(true);
  });
});
