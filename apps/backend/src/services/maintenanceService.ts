import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { writeAuditLog } from './auditLogService';

// Owner Web — Maintenance tracker (OW-9, PRD §22.1): a task list per turf with
// status, priority, due date and cost, instead of a bare "maintenance" reason on
// an availability block.

export class MaintenanceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'MaintenanceError';
  }
}

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface MaintenanceTask {
  task_id: string;
  turf_id: string;
  turf_name: string;
  title: string;
  description: string | null;
  category: 'PITCH' | 'NETS' | 'LIGHTING' | 'FACILITIES' | 'EQUIPMENT' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: TaskStatus;
  due_date: string | null;
  cost: number | null;
  assigned_to: string | null;
  completed_at: Date | null;
  created_at: Date;
  overdue: boolean;
}

export interface TaskInput {
  turf_id: string;
  title: string;
  description?: string | null;
  category?: MaintenanceTask['category'];
  priority?: MaintenanceTask['priority'];
  due_date?: string | null;
  cost?: number | null;
  assigned_to?: string | null;
}

const SELECT = `SELECT m.*, t.turf_name FROM maintenance_tasks m
                JOIN turfs t ON t.turf_id = m.turf_id`;

const dateStr = (v: unknown): string | null =>
  v == null
    ? null
    : typeof v === 'string'
      ? v.slice(0, 10)
      : new Date(v as Date).toISOString().slice(0, 10);

function present(
  row: Record<string, unknown>,
  today = new Date().toISOString().slice(0, 10),
): MaintenanceTask {
  const due = dateStr(row.due_date);
  return {
    ...(row as unknown as MaintenanceTask),
    due_date: due,
    cost: row.cost == null ? null : Number(row.cost),
    overdue: !!due && due < today && row.status !== 'DONE',
  };
}

async function assertOwnsTurf(ownerId: string, turfId: string) {
  const rows = await sequelize.query<{ turf_id: string }>(
    'SELECT turf_id FROM turfs WHERE turf_id = :turfId AND owner_id = :ownerId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { turfId, ownerId } },
  );
  if (rows.length === 0) throw new MaintenanceError('Turf not found.', 404);
}

async function loadOwned(ownerId: string, taskId: string) {
  const [row] = await sequelize.query<Record<string, unknown>>(
    `${SELECT} WHERE m.task_id = :taskId AND t.owner_id = :ownerId`,
    { type: QueryTypes.SELECT, replacements: { taskId, ownerId } },
  );
  if (!row) throw new MaintenanceError('Task not found.', 404);
  return row;
}

export async function listTasks(
  ownerId: string,
  filters: { turfId?: string; status?: TaskStatus } = {},
): Promise<MaintenanceTask[]> {
  const where = ['t.owner_id = :ownerId', 't.deleted_at IS NULL'];
  const replacements: Record<string, unknown> = { ownerId };
  if (filters.turfId) {
    where.push('m.turf_id = :turfId');
    replacements.turfId = filters.turfId;
  }
  if (filters.status) {
    where.push('m.status = :status');
    replacements.status = filters.status;
  }
  const rows = await sequelize.query<Record<string, unknown>>(
    `${SELECT} WHERE ${where.join(' AND ')}
     ORDER BY FIELD(m.priority, 'HIGH', 'MEDIUM', 'LOW'), m.due_date IS NULL, m.due_date ASC, m.created_at DESC`,
    { type: QueryTypes.SELECT, replacements },
  );
  return rows.map((r) => present(r));
}

export async function createTask(ownerId: string, input: TaskInput): Promise<MaintenanceTask> {
  await assertOwnsTurf(ownerId, input.turf_id);
  const id = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('maintenance_tasks', [
    {
      task_id: id,
      turf_id: input.turf_id,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? 'OTHER',
      priority: input.priority ?? 'MEDIUM',
      status: 'OPEN',
      due_date: input.due_date ?? null,
      cost: input.cost ?? null,
      assigned_to: input.assigned_to ?? null,
      created_by: ownerId,
      completed_at: null,
      created_at: now,
      updated_at: now,
    },
  ]);
  await writeAuditLog({
    actorUserId: ownerId,
    actorRole: 'TURF_OWNER',
    action: 'MAINTENANCE_TASK_CREATED',
    resourceType: 'maintenance_task',
    resourceId: id,
    afterData: { title: input.title, turf_id: input.turf_id },
  });
  return present(await loadOwned(ownerId, id));
}

export async function updateTask(
  ownerId: string,
  taskId: string,
  changes: Partial<Omit<TaskInput, 'turf_id'>> & { status?: TaskStatus },
): Promise<MaintenanceTask> {
  const existing = await loadOwned(ownerId, taskId);
  const values: Record<string, unknown> = {};
  for (const key of [
    'title',
    'description',
    'category',
    'priority',
    'due_date',
    'cost',
    'assigned_to',
  ] as const) {
    if (changes[key] !== undefined) values[key] = changes[key];
  }
  if (changes.status !== undefined && changes.status !== existing.status) {
    values.status = changes.status;
    values.completed_at = changes.status === 'DONE' ? new Date() : null;
  }
  if (Object.keys(values).length === 0) return present(existing);
  await sequelize
    .getQueryInterface()
    .bulkUpdate('maintenance_tasks', { ...values, updated_at: new Date() }, { task_id: taskId });
  if (values.status) {
    await writeAuditLog({
      actorUserId: ownerId,
      actorRole: 'TURF_OWNER',
      action: 'MAINTENANCE_TASK_STATUS_CHANGED',
      resourceType: 'maintenance_task',
      resourceId: taskId,
      beforeData: { status: existing.status },
      afterData: { status: values.status },
    });
  }
  return present(await loadOwned(ownerId, taskId));
}

export async function deleteTask(ownerId: string, taskId: string): Promise<void> {
  await loadOwned(ownerId, taskId);
  await sequelize.getQueryInterface().bulkDelete('maintenance_tasks', { task_id: taskId });
}
