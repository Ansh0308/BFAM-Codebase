'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceTask,
  Turf,
} from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { formatDay, formatRupees } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../components/ui/Drawer';
import { EASE_OUT } from '../../../components/ui/motion';
import { useToast } from '../../../components/ui/Toast';
import {
  Button,
  EmptyState,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

const COLUMNS: {
  status: MaintenanceStatus;
  label: string;
  next?: MaintenanceStatus;
  nextLabel?: string;
}[] = [
  { status: 'OPEN', label: 'To do', next: 'IN_PROGRESS', nextLabel: 'Start' },
  { status: 'IN_PROGRESS', label: 'In progress', next: 'DONE', nextLabel: 'Mark done' },
  { status: 'DONE', label: 'Done' },
];
const PRIORITY_TONE: Record<MaintenancePriority, Tone> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'neutral',
};
const CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  PITCH: 'Pitch',
  NETS: 'Nets',
  LIGHTING: 'Lighting',
  FACILITIES: 'Facilities',
  EQUIPMENT: 'Equipment',
  OTHER: 'Other',
};

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[42px] font-ui text-body text-text-primary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

// Maintenance tracker (OW-9, PRD §22.1): what needs fixing at each turf, who is
// on it, when it is due and what it cost.
export default function OwnerMaintenancePage() {
  const toast = useToast();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [turfId, setTurfId] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MaintenanceTask | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MaintenanceTask | null>(null);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => setTurfs(res.results))
      .catch(() => setTurfs([]));
  }, []);

  const load = useCallback(async () => {
    try {
      setTasks((await apiClient.getMaintenanceTasks(turfId ? { turf_id: turfId } : {})).results);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [turfId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      open: tasks.filter((t) => t.status !== 'DONE').length,
      overdue: tasks.filter((t) => t.overdue).length,
      spent: tasks.filter((t) => t.status === 'DONE').reduce((sum, t) => sum + (t.cost ?? 0), 0),
    }),
    [tasks],
  );

  async function move(task: MaintenanceTask, status: MaintenanceStatus) {
    try {
      await apiClient.updateMaintenanceTask(task.task_id, { status });
      toast.success(status === 'DONE' ? 'Marked done' : 'Moved to in progress');
      await load();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not update that task.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiClient.deleteMaintenanceTask(deleting.task_id);
      toast.success('Task deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not delete that task.');
      setDeleting(null);
    }
  }

  return (
    <div data-testid="owner-maintenance-page">
      <PageHeader
        title="Maintenance"
        subtitle="Keep your turfs in shape."
        action={
          <div className="flex items-center gap-3">
            {turfs.length > 1 && (
              <select
                aria-label="Filter by turf"
                value={turfId}
                onChange={(e) => setTurfId(e.target.value)}
                data-testid="maintenance-turf"
                className="h-[40px] rounded-md border border-border-strong bg-surface px-3 font-ui text-body focus:border-brand-red focus:outline-none"
              >
                <option value="">All turfs</option>
                {turfs.map((t) => (
                  <option key={t.turf_id} value={t.turf_id}>
                    {t.turf_name}
                  </option>
                ))}
              </select>
            )}
            <Button
              icon={Plus}
              onClick={() => setEditing('new')}
              testID="new-task"
              disabled={turfs.length === 0}
            >
              New task
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4" data-testid="maintenance-stats">
        {[
          { label: 'Open tasks', value: String(stats.open), icon: Wrench },
          {
            label: 'Overdue',
            value: String(stats.overdue),
            icon: AlertTriangle,
            alert: stats.overdue > 0,
          },
          { label: 'Spent (done)', value: formatRupees(stats.spent), icon: IndianRupee },
        ].map(({ label, value, icon: Icon, alert }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4"
          >
            <span
              className={`grid h-[40px] w-[40px] place-items-center rounded-md ${alert ? 'bg-status-danger-bg text-status-danger' : 'bg-brand-red/10 text-brand-red'}`}
            >
              <Icon className="h-[20px] w-[20px]" />
            </span>
            <div>
              <p className="font-ui text-micro uppercase tracking-wider text-text-tertiary">
                {label}
              </p>
              <p className="font-display text-[30px] leading-none text-ink-black">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nothing to maintain yet"
          message="Add a task when something needs fixing — a worn pitch, a broken floodlight, torn nets."
          testID="maintenance-empty"
          action={
            turfs.length > 0 ? (
              <Button icon={Plus} onClick={() => setEditing('new')}>
                New task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-3" data-testid="maintenance-board">
          {COLUMNS.map((col) => {
            const list = tasks.filter((t) => t.status === col.status);
            return (
              <section
                key={col.status}
                data-testid={`column-${col.status}`}
                className="rounded-lg bg-ink-black/[0.03] p-3"
              >
                <h2 className="mb-3 flex items-center justify-between px-2 font-ui text-micro uppercase tracking-wider text-text-secondary">
                  {col.label}
                  <span className="rounded-[999px] bg-ink-black/[0.07] px-2 text-[11px] leading-[18px]">
                    {list.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {list.map((t, i) => (
                    <motion.article
                      key={t.task_id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04, ease: EASE_OUT }}
                      data-testid={`task-${t.task_id}`}
                      className={`rounded-lg border bg-surface p-4 ${t.overdue ? 'border-status-danger/50' : 'border-border-subtle'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-ui text-body font-bold text-ink-black">{t.title}</p>
                        <StatusPill label={t.priority} tone={PRIORITY_TONE[t.priority]} />
                      </div>
                      <p className="mt-1 font-ui text-micro text-text-tertiary">
                        {t.turf_name} · {CATEGORY_LABEL[t.category]}
                        {t.assigned_to ? ` · ${t.assigned_to}` : ''}
                      </p>
                      {t.description && (
                        <p className="mt-2 font-ui text-body text-text-secondary">
                          {t.description}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[12px] text-text-secondary">
                        {t.due_date && (
                          <span
                            className={`inline-flex items-center gap-1 ${t.overdue ? 'font-bold text-status-danger' : ''}`}
                            data-testid={t.overdue ? `overdue-${t.task_id}` : undefined}
                          >
                            <CalendarClock className="h-[13px] w-[13px]" />
                            {t.overdue ? 'Overdue · ' : 'Due '}
                            {formatDay(t.due_date, { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {t.cost != null && (
                          <span className="inline-flex items-center gap-1">
                            <IndianRupee className="h-[13px] w-[13px]" />
                            {formatRupees(t.cost)}
                          </span>
                        )}
                        {t.status === 'DONE' && (
                          <CheckCircle2 className="h-[14px] w-[14px] text-status-success" />
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {col.next && (
                          <Button
                            size="sm"
                            icon={ArrowRight}
                            onClick={() => move(t, col.next!)}
                            testID={`advance-${t.task_id}`}
                          >
                            {col.nextLabel}
                          </Button>
                        )}
                        {t.status === 'DONE' && (
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() => move(t, 'OPEN')}
                            testID={`reopen-${t.task_id}`}
                          >
                            Reopen
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Pencil}
                          ariaLabel={`Edit ${t.title}`}
                          onClick={() => setEditing(t)}
                          testID={`edit-${t.task_id}`}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          ariaLabel={`Delete ${t.title}`}
                          onClick={() => setDeleting(t)}
                          testID={`delete-${t.task_id}`}
                        />
                      </div>
                    </motion.article>
                  ))}
                  {list.length === 0 && (
                    <p className="px-2 py-4 font-ui text-body text-text-tertiary">Nothing here.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New task' : 'Edit task'}
        testID="task-drawer"
      >
        {editing !== null && (
          <TaskForm
            turfs={turfs}
            task={editing === 'new' ? null : editing}
            defaultTurf={turfId}
            onSaved={async () => {
              toast.success(editing === 'new' ? 'Task added' : 'Task updated');
              setEditing(null);
              await load();
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this task?"
        message={deleting ? `“${deleting.title}” is removed for good.` : ''}
        confirmLabel="Delete task"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        testID="task-delete-dialog"
      />
    </div>
  );
}

function TaskForm({
  turfs,
  task,
  defaultTurf,
  onSaved,
}: {
  turfs: Turf[];
  task: MaintenanceTask | null;
  defaultTurf: string;
  onSaved: () => void;
}) {
  const [turfId, setTurfId] = useState(task?.turf_id ?? (defaultTurf || turfs[0]?.turf_id) ?? '');
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [category, setCategory] = useState<MaintenanceCategory>(task?.category ?? 'PITCH');
  const [priority, setPriority] = useState<MaintenancePriority>(task?.priority ?? 'MEDIUM');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [cost, setCost] = useState(task?.cost != null ? String(task.cost) : '');
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (title.trim().length < 2) return setError('Give the task a title.');
    if (!task && !turfId) return setError('Choose a turf.');
    if (cost !== '' && !(Number(cost) >= 0)) return setError('Cost must be zero or more.');
    setError(null);
    setSaving(true);
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      priority,
      due_date: dueDate || null,
      cost: cost === '' ? null : Number(cost),
      assigned_to: assignedTo.trim() || null,
    };
    try {
      if (task) await apiClient.updateMaintenanceTask(task.task_id, body);
      else await apiClient.createMaintenanceTask({ turf_id: turfId, ...body });
      onSaved();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="task-form"
    >
      {!task && turfs.length > 1 && (
        <label className="mb-4 block">
          <span className={LABEL}>Turf</span>
          <select
            value={turfId}
            onChange={(e) => setTurfId(e.target.value)}
            data-testid="task-turf"
            className={FIELD}
          >
            {turfs.map((t) => (
              <option key={t.turf_id} value={t.turf_id}>
                {t.turf_name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="mb-4 block">
        <span className={LABEL}>What needs doing</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Re-roll the pitch"
          data-testid="task-title"
          className={FIELD}
        />
      </label>
      <label className="mb-4 block">
        <span className={LABEL}>Details (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          data-testid="task-description"
          className={`${FIELD} h-auto py-2`}
        />
      </label>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className={LABEL}>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
            data-testid="task-category"
            className={FIELD}
          >
            {(Object.keys(CATEGORY_LABEL) as MaintenanceCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
            data-testid="task-priority"
            className={FIELD}
          >
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>Due</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            data-testid="task-due"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Cost (₹)</span>
          <input
            type="number"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            data-testid="task-cost"
            className={FIELD}
          />
        </label>
      </div>
      <label className="mb-5 block">
        <span className={LABEL}>Assigned to (optional)</span>
        <input
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          placeholder="Name or contractor"
          data-testid="task-assignee"
          className={FIELD}
        />
      </label>
      {error && (
        <p
          role="alert"
          data-testid="task-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="task-submit">
        {task ? 'Save changes' : 'Add task'}
      </Button>
    </form>
  );
}
