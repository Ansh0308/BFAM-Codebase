// Backlog G-24: updateTicketStatus (the one real admin-only write path in
// the app today — POST /support/tickets/:ticketId/status) must write an
// audit_logs entry for every status change.

const TICKET_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const RAISED_BY = 'bbbbbbbb-0000-4000-8000-000000000002';
const ADMIN_ID = 'cccccccc-0000-4000-8000-000000000003';

interface TicketRow {
  ticket_id: string;
  raised_by: string;
  status: string;
  category: string;
  description: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  dispute_type: string;
  assigned_to: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

let tickets: TicketRow[] = [];
let auditLogs: Array<Record<string, unknown>> = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM support_tickets WHERE ticket_id')) {
          // Returns a fresh copy, like a real SQL query result would — not
          // a live reference into `tickets` (a later bulkUpdate must not
          // retroactively mutate a row object an earlier fetch already
          // captured).
          const t = tickets.find((x) => x.ticket_id === r.ticketId);
          return t ? [{ ...t }] : [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'support_tickets') {
            const t = tickets.find((x) => x.ticket_id === where.ticket_id);
            if (t) Object.assign(t, values);
          }
        },
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'audit_logs') auditLogs.push(...rows);
        },
      }),
    },
  };
});

jest.mock('../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({ notification_id: null, pushed: false }),
}));

import { updateTicketStatus } from '../services/supportService';

describe('updateTicketStatus audit logging (backlog G-24)', () => {
  beforeEach(() => {
    tickets = [
      {
        ticket_id: TICKET_ID,
        raised_by: RAISED_BY,
        status: 'OPEN',
        category: 'BOOKING_ISSUE',
        description: 'Test',
        related_entity_type: null,
        related_entity_id: null,
        dispute_type: 'COMPLAINT',
        assigned_to: null,
        created_at: new Date(),
        resolved_at: null,
      },
    ];
    auditLogs = [];
  });

  it('writes a SUPPORT_TICKET_STATUS_CHANGED audit entry with the before/after status', async () => {
    await updateTicketStatus(TICKET_ID, ADMIN_ID, 'IN_PROGRESS');

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      action: 'SUPPORT_TICKET_STATUS_CHANGED',
      resource_type: 'support_ticket',
      resource_id: TICKET_ID,
      actor_user_id: ADMIN_ID,
      actor_role: 'ADMIN',
    });
    expect(JSON.parse(auditLogs[0].before_data as string)).toEqual({ status: 'OPEN' });
    expect(JSON.parse(auditLogs[0].after_data as string)).toEqual({ status: 'IN_PROGRESS' });
  });

  it('does not write an audit entry when the transition is rejected', async () => {
    await expect(updateTicketStatus(TICKET_ID, ADMIN_ID, 'RESOLVED')).rejects.toThrow();
    expect(auditLogs).toHaveLength(0);
  });
});
