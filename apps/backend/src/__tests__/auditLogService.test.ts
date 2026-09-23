// Backlog G-24: writeAuditLog is the one shared way every write path now
// logs to audit_logs — verifies the row shape and that a write failure
// never throws (an audit-log write must never block the real action it
// describes).

let auditLogs: Array<Record<string, unknown>> = [];
let shouldFail = false;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (shouldFail) throw new Error('DB unavailable');
          if (table === 'audit_logs') auditLogs.push(...rows);
        },
      }),
    },
  };
});

import { writeAuditLog } from '../services/auditLogService';

describe('writeAuditLog (backlog G-24)', () => {
  beforeEach(() => {
    auditLogs = [];
    shouldFail = false;
  });

  it('writes a row with the given actor/action/resource and JSON-encoded before/after data', async () => {
    await writeAuditLog({
      actorUserId: 'user-1',
      actorRole: 'PLAYER',
      action: 'BOOKING_CANCELLED',
      resourceType: 'booking',
      resourceId: 'booking-1',
      beforeData: { booking_status: 'PENDING' },
      afterData: { booking_status: 'CANCELLED' },
    });

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      actor_user_id: 'user-1',
      actor_role: 'PLAYER',
      action: 'BOOKING_CANCELLED',
      resource_type: 'booking',
      resource_id: 'booking-1',
    });
    expect(JSON.parse(auditLogs[0].before_data as string)).toEqual({ booking_status: 'PENDING' });
    expect(JSON.parse(auditLogs[0].after_data as string)).toEqual({ booking_status: 'CANCELLED' });
  });

  it('stores null for before/after data when omitted, not the string "undefined"', async () => {
    await writeAuditLog({
      actorUserId: null,
      actorRole: null,
      action: 'SYSTEM_EVENT',
      resourceType: 'system',
      resourceId: 'n/a',
    });

    expect(auditLogs[0].before_data).toBeNull();
    expect(auditLogs[0].after_data).toBeNull();
  });

  it('swallows a write failure rather than throwing, so it never blocks the caller', async () => {
    shouldFail = true;
    await expect(
      writeAuditLog({
        actorUserId: 'user-1',
        actorRole: 'PLAYER',
        action: 'BOOKING_CANCELLED',
        resourceType: 'booking',
        resourceId: 'booking-1',
      }),
    ).resolves.toBeUndefined();
  });
});
