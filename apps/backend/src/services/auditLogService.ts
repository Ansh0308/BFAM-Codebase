import { randomUUID } from 'crypto';
import { sequelize } from '../config/sequelize';

// Backlog G-24: a single, consistent way to write an audit_logs entry —
// previously each write path (bookingService's cancel/reschedule) inlined
// its own bulkInsert. Centralized here so payment/refund and admin-action
// call sites don't each reimplement the same shape, and so a failure to
// write the log (should never happen, but audit_logs is not on any hot
// path a user-facing action needs to succeed) never blocks the action it's
// describing.
export interface AuditLogEntry {
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeData?: unknown;
  afterData?: unknown;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await sequelize.getQueryInterface().bulkInsert('audit_logs', [
      {
        log_id: randomUUID(),
        actor_user_id: entry.actorUserId,
        actor_role: entry.actorRole,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        before_data: entry.beforeData !== undefined ? JSON.stringify(entry.beforeData) : null,
        after_data: entry.afterData !== undefined ? JSON.stringify(entry.afterData) : null,
        ip_address: null,
        request_id: null,
        created_at: new Date(),
      },
    ]);
  } catch {
    // Deliberately swallowed — see module comment above. An audit-log
    // write failure must never surface as a failure of the real action.
  }
}
