// Backlog G-21: recordConsent/getMyConsents — the append-only consent log
// with policy versioning.

let consents: Array<Record<string, unknown>> = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM user_consents WHERE user_id')) {
          return consents
            .filter((c) => c.user_id === r.userId)
            .sort((a, b) => (b.accepted_at as Date).getTime() - (a.accepted_at as Date).getTime());
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'user_consents') consents.push(...rows);
        },
      }),
    },
  };
});

import { recordConsent, getMyConsents, CURRENT_POLICY_VERSION } from '../services/consentService';

describe('consentService (backlog G-21)', () => {
  beforeEach(() => {
    consents = [];
  });

  it('records a consent row stamped with the current policy version', async () => {
    await recordConsent('user-1', 'TERMS');

    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({
      user_id: 'user-1',
      consent_type: 'TERMS',
      policy_version: CURRENT_POLICY_VERSION,
    });
  });

  it('appends rather than overwrites — re-accepting keeps both rows', async () => {
    await recordConsent('user-1', 'TERMS', new Date('2026-01-01'));
    await recordConsent('user-1', 'TERMS', new Date('2026-09-24'));

    const history = await getMyConsents('user-1');
    expect(history).toHaveLength(2);
    // Most recent first.
    expect(history[0].accepted_at).toEqual(new Date('2026-09-24'));
  });

  it('keeps consent categories independent of each other', async () => {
    await recordConsent('user-1', 'TERMS');
    await recordConsent('user-1', 'CONTACTS');

    const history = await getMyConsents('user-1');
    expect(history.map((c) => c.consent_type).sort()).toEqual(['CONTACTS', 'TERMS']);
  });

  it("never returns another user's consent history", async () => {
    await recordConsent('user-1', 'TERMS');
    await recordConsent('user-2', 'TERMS');

    const history = await getMyConsents('user-1');
    expect(history).toHaveLength(1);
    expect(history[0].user_id).toBe('user-1');
  });
});
