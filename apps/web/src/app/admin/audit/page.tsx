'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  CalendarX2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LifeBuoy,
  RefreshCw,
  ScrollText,
  Swords,
  Ticket,
} from 'lucide-react';
import type { AdminAuditLog } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { humanize, timeAgo } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { EASE_OUT } from '../../../components/ui/motion';
import { Button, EmptyState, SearchInput, SkeletonRows } from '../../../components/ui/kit';

const PAGE_SIZE = 25;

const RESOURCES = [
  { value: '', label: 'All activity' },
  { value: 'booking', label: 'Bookings' },
  { value: 'support_ticket', label: 'Support tickets' },
  { value: 'promo_code', label: 'Promo codes' },
  { value: 'payment', label: 'Payments' },
  { value: 'match', label: 'Matches' },
];

const ICONS: Record<string, typeof ScrollText> = {
  booking: CalendarX2,
  support_ticket: LifeBuoy,
  promo_code: Ticket,
  payment: CreditCard,
  match: Swords,
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function show(v: unknown): string {
  if (v === null || v === undefined) return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

// Audit log (PRD §9.1, backlog G-24): every cancellation, refund, correction
// and admin action, newest first. Open a row to see exactly what changed.
export default function AdminAuditPage() {
  const [rows, setRows] = useState<AdminAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [resource, setResource] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await apiClient.getAuditLogs({
          ...(resource ? { resource_type: resource } : {}),
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRows(res.results);
        setTotal(res.total);
      } catch {
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [resource, page],
  );

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.action, r.actor_phone, r.actor_role, r.resource_type, r.resource_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0);

  return (
    <div data-testid="admin-audit-page">
      <PageHeader
        title="Audit Log"
        subtitle="A record of sensitive actions across the platform."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => load(true)}
            testID="audit-refresh"
          >
            Refresh
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <select
          value={resource}
          onChange={(e) => {
            setResource(e.target.value);
            setPage(0);
          }}
          aria-label="Filter by area"
          data-testid="audit-resource"
          className="h-[42px] cursor-pointer rounded-md border border-border-strong bg-surface px-3 font-ui text-body text-text-primary hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]"
        >
          {RESOURCES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <div className="ml-auto w-full max-w-[340px]">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search this page — action, phone or ID"
            ariaLabel="Search the audit log"
            testID="audit-search"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity"
          message={
            rows.length === 0
              ? 'Nothing has been logged for this view yet.'
              : 'No entries on this page match your search.'
          }
          testID="audit-empty"
        />
      ) : (
        <ul className="space-y-3" data-testid="audit-list">
          {visible.map((r, index) => {
            const Icon = ICONS[r.resource_type] ?? ScrollText;
            const isOpen = expanded === r.log_id;
            const before = asRecord(r.before_data);
            const after = asRecord(r.after_data);
            const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
            return (
              <motion.li
                key={r.log_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.03, ease: EASE_OUT }}
                className="overflow-hidden rounded-lg border border-border-subtle bg-surface transition-shadow duration-300 hover:shadow-[0_10px_26px_rgba(0,0,0,0.07)]"
                data-testid={`audit-${r.log_id}`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : r.log_id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left cursor-pointer"
                >
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-md bg-brand-red/10 text-brand-red">
                    <Icon className="h-[19px] w-[19px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-body font-bold text-ink-black">
                      {humanize(r.action)}
                    </p>
                    <p className="truncate font-ui text-[12px] text-text-tertiary">
                      {r.actor_phone ?? r.actor_role ?? 'System'} ·{' '}
                      {r.resource_type.replace(/_/g, ' ')} · {r.resource_id.slice(0, 8)}…
                    </p>
                  </div>
                  <span className="shrink-0 font-ui text-[12px] text-text-tertiary">
                    {timeAgo(r.created_at)}
                  </span>
                  <ChevronDown
                    className={`h-[18px] w-[18px] shrink-0 text-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-red' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div
                        className="border-t border-border-subtle bg-ink-black/[0.02] px-5 py-4"
                        data-testid="audit-detail"
                      >
                        <p className="mb-3 font-ui text-[12px] text-text-tertiary">
                          {new Date(r.created_at).toLocaleString('en-IN')}
                          {r.actor_role ? ` · ${r.actor_role}` : ''}
                        </p>
                        {keys.length === 0 ? (
                          <p className="font-ui text-body text-text-tertiary">
                            No before/after details were recorded.
                          </p>
                        ) : (
                          <dl className="space-y-2">
                            {keys.map((k) => {
                              const was = before?.[k];
                              const now = after?.[k];
                              const changed = show(was) !== show(now);
                              return (
                                <div
                                  key={k}
                                  className="flex flex-wrap items-center gap-3 font-ui text-body"
                                >
                                  <dt className="w-[170px] shrink-0 text-text-secondary">
                                    {humanize(k)}
                                  </dt>
                                  <dd className="flex items-center gap-2">
                                    <span
                                      className={
                                        changed
                                          ? 'text-text-tertiary line-through'
                                          : 'text-ink-black'
                                      }
                                    >
                                      {show(was)}
                                    </span>
                                    {changed && (
                                      <>
                                        <ArrowRight className="h-[14px] w-[14px] text-brand-red" />
                                        <span className="font-bold text-ink-black">
                                          {show(now)}
                                        </span>
                                      </>
                                    )}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-between" data-testid="audit-pager">
          <p className="font-ui text-body text-text-tertiary">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={ChevronLeft}
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              testID="audit-prev"
            >
              Newer
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= lastPage}
              onClick={() => setPage(page + 1)}
              testID="audit-next"
            >
              Older <ChevronRight className="h-[16px] w-[16px]" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
