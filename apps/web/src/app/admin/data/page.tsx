'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Database, Lock, Plus, RefreshCw, Table2 } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { ExplorerRows, ExplorerTable } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader } from '../../../components/DashboardShell';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../components/ui/Drawer';
import { useToast } from '../../../components/ui/Toast';
import {
  Button,
  EmptyState,
  SearchInput,
  SkeletonRows,
  StatusPill,
} from '../../../components/ui/kit';

const PAGE_SIZE = 25;
const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[40px] font-ui text-body text-text-primary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Data Explorer — the "CRUD on anything" tool. Browse every table in the
// database and add, edit or delete rows. Password hashes, tokens and OTPs are
// never shown or editable; the audit log and payment ledger are read-only;
// every change is written to the audit log.
export default function AdminDataPage() {
  const toast = useToast();
  const [tables, setTables] = useState<ExplorerTable[]>([]);
  const [tableQuery, setTableQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<ExplorerRows | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getExplorerTables()
      .then((res) => setTables(res.results))
      .catch(() => setTables([]));
  }, []);

  const loadRows = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      setData(
        await apiClient.getExplorerRows(selected, {
          limit: PAGE_SIZE,
          offset,
          ...(appliedSearch ? { search: appliedSearch } : {}),
        }),
      );
    } catch (err) {
      setData(null);
      setError(err instanceof BFAMApiError ? err.message : 'Could not load that table.');
    } finally {
      setLoading(false);
    }
  }, [selected, offset, appliedSearch]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function pick(name: string) {
    setSelected(name);
    setOffset(0);
    setSearch('');
    setAppliedSearch('');
    setData(null);
  }

  const shownTables = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    return q ? tables.filter((t) => t.name.includes(q)) : tables;
  }, [tables, tableQuery]);

  const pk = data?.primary_key ?? null;
  const columns = data?.columns ?? [];
  const visibleColumns = columns.filter((c) => !c.masked);
  const readOnly = data?.read_only ?? true;

  async function confirmDelete() {
    if (!deleting || !selected || !pk) return;
    setBusy(true);
    try {
      await apiClient.deleteExplorerRow(selected, cell(deleting[pk]));
      toast.success('Row deleted');
      setDeleting(null);
      await loadRows();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not delete that row.');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="admin-data-page">
      <PageHeader
        title="Data Explorer"
        subtitle="Browse and edit any table. Secrets are hidden and every change is audit-logged."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-border-subtle bg-surface p-3 xl:sticky xl:top-[88px] xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
          <SearchInput
            value={tableQuery}
            onChange={setTableQuery}
            placeholder="Find a table"
            ariaLabel="Find a table"
            testID="table-search"
          />
          <ul className="mt-3 space-y-[2px]" data-testid="table-list">
            {shownTables.map((t) => (
              <li key={t.name}>
                <button
                  onClick={() => pick(t.name)}
                  data-testid={`table-${t.name}`}
                  aria-current={selected === t.name ? 'true' : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 h-[38px] text-left font-ui text-body cursor-pointer transition-colors ${
                    selected === t.name
                      ? 'bg-brand-red text-white'
                      : 'text-text-secondary hover:bg-ink-black/[0.05] hover:text-ink-black'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Table2 className="h-[15px] w-[15px] shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </span>
                  {t.read_only && <Lock className="h-[12px] w-[12px] shrink-0 opacity-70" />}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-w-0">
          {!selected ? (
            <EmptyState
              icon={Database}
              title="Pick a table"
              message="Choose a table on the left to see its rows."
              testID="data-empty"
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-[26px] leading-none tracking-wide text-ink-black">
                  {selected}
                </h2>
                {data && (
                  <span className="font-ui text-body text-text-tertiary">
                    {data.total.toLocaleString('en-IN')} rows
                  </span>
                )}
                {readOnly && data && <StatusPill label="Read only" tone="warning" />}
                <div className="ml-auto flex items-center gap-3">
                  <div className="w-[260px]">
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      onSubmit={() => {
                        setOffset(0);
                        setAppliedSearch(search.trim());
                      }}
                      placeholder="Search text columns"
                      ariaLabel="Search rows"
                      testID="row-search"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    icon={RefreshCw}
                    onClick={() => loadRows()}
                    ariaLabel="Refresh rows"
                    testID="rows-refresh"
                  />
                  {!readOnly && (
                    <Button icon={Plus} onClick={() => setAdding(true)} testID="add-row">
                      Add row
                    </Button>
                  )}
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mb-4 font-ui text-body text-brand-red"
                  data-testid="data-error"
                >
                  {error}
                </p>
              )}

              {loading && !data ? (
                <SkeletonRows rows={6} />
              ) : data && data.rows.length === 0 ? (
                <EmptyState
                  icon={Table2}
                  title="No rows"
                  message={appliedSearch ? 'Nothing matches that search.' : 'This table is empty.'}
                  testID="rows-empty"
                />
              ) : data ? (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
                    <table className="min-w-full text-left" data-testid="rows-table">
                      <thead>
                        <tr className="border-b border-border-subtle bg-ink-black/[0.03]">
                          {visibleColumns.map((c) => (
                            <th
                              key={c.name}
                              className="whitespace-nowrap px-4 py-3 font-ui text-micro uppercase tracking-wide text-text-secondary"
                            >
                              {c.name}
                              {c.primary ? ' 🔑' : ''}
                            </th>
                          ))}
                          {!readOnly && <th className="px-4 py-3" />}
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row, i) => (
                          <tr
                            key={pk ? cell(row[pk]) : i}
                            className="border-b border-border-subtle last:border-0 hover:bg-brand-red/[0.03]"
                            data-testid={`row-${pk ? cell(row[pk]) : i}`}
                          >
                            {visibleColumns.map((c) => (
                              <td
                                key={c.name}
                                title={cell(row[c.name])}
                                className="max-w-[260px] truncate whitespace-nowrap px-4 py-[10px] font-ui text-body text-text-primary"
                              >
                                {row[c.name] === null ? (
                                  <span className="text-text-tertiary">null</span>
                                ) : (
                                  cell(row[c.name])
                                )}
                              </td>
                            ))}
                            {!readOnly && (
                              <td className="whitespace-nowrap px-4 py-[6px] text-right">
                                <Button
                                  size="sm"
                                  variant="soft"
                                  onClick={() => setEditing(row)}
                                  testID={`edit-row-${pk ? cell(row[pk]) : i}`}
                                >
                                  Edit
                                </Button>{' '}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleting(row)}
                                  testID={`delete-row-${pk ? cell(row[pk]) : i}`}
                                >
                                  Delete
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="font-ui text-body text-text-tertiary">
                      {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of{' '}
                      {data.total.toLocaleString('en-IN')}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={ChevronLeft}
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                        testID="rows-prev"
                      >
                        Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={offset + PAGE_SIZE >= data.total}
                        onClick={() => setOffset(offset + PAGE_SIZE)}
                        testID="rows-next"
                      >
                        Next
                        <ChevronRight className="h-[16px] w-[16px]" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}
        </section>
      </div>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit row"
        subtitle={selected ?? undefined}
        testID="row-edit-drawer"
      >
        {editing && data && selected && pk && (
          <RowForm
            mode="edit"
            columns={visibleColumns}
            initial={editing}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              await apiClient.updateExplorerRow(selected, cell(editing[pk]), values);
              toast.success('Row updated');
              setEditing(null);
              await loadRows();
            }}
          />
        )}
      </Drawer>

      <Drawer
        open={adding}
        onClose={() => setAdding(false)}
        title="Add row"
        subtitle={selected ?? undefined}
        testID="row-add-drawer"
      >
        {adding && data && selected && (
          <RowForm
            mode="add"
            columns={visibleColumns}
            initial={{}}
            submitLabel="Add row"
            onSubmit={async (values) => {
              await apiClient.insertExplorerRow(selected, values);
              toast.success('Row added');
              setAdding(false);
              await loadRows();
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this row?"
        message="This permanently removes the row from the database. It can’t be undone."
        confirmLabel="Delete row"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        testID="row-delete-dialog"
      />
    </div>
  );
}

type FormColumn = ExplorerRows['columns'][number];

function RowForm({
  mode,
  columns,
  initial,
  submitLabel,
  onSubmit,
}: {
  mode: 'edit' | 'add';
  columns: FormColumn[];
  initial: Record<string, unknown>;
  submitLabel: string;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}) {
  const editable = columns.filter(
    (c) => !(c.primary && mode === 'edit') && c.name !== 'created_at' && c.name !== 'updated_at',
  );
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(editable.map((c) => [c.name, cell(initial[c.name])])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const values: Record<string, unknown> = {};
    for (const c of editable) {
      const next = draft[c.name] ?? '';
      if (mode === 'edit') {
        if (next === cell(initial[c.name])) continue;
        values[c.name] = next === '' && c.nullable ? null : next;
      } else if (next !== '') {
        values[c.name] = next;
      }
    }
    if (Object.keys(values).length === 0) {
      setError(mode === 'edit' ? 'Nothing was changed.' : 'Fill in at least one field.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'The change was refused.');
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
      data-testid="row-form"
    >
      {editable.map((c) => (
        <label key={c.name} className="mb-4 block">
          <span className={LABEL}>
            {c.name}
            <span className="ml-2 normal-case tracking-normal text-text-tertiary">{c.type}</span>
          </span>
          <input
            value={draft[c.name] ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [c.name]: e.target.value }))}
            placeholder={c.nullable ? 'empty = null' : ''}
            data-testid={`field-${c.name}`}
            className={FIELD}
          />
        </label>
      ))}
      {error && (
        <p
          role="alert"
          data-testid="row-form-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="row-submit">
        {submitLabel}
      </Button>
    </form>
  );
}
