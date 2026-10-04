'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Banknote,
  CheckCheck,
  CreditCard,
  Download,
  Landmark,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import type { OwnerPayment } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { addDays, formatDay, formatRupees, toISODate, todayISO } from '../../../lib/dates';
import { PageHeader, DataTable } from '../../../components/DashboardShell';
import { EASE_OUT } from '../../../components/ui/motion';
import {
  Button,
  EmptyState,
  SegmentedControl,
  SkeletonRows,
  StatTile,
  StatusPill,
} from '../../../components/ui/kit';

type View = 'all' | 'cash';
type Window = '7' | '30' | 'all';

const COUNTED_KEY = 'bfam_owner_cash_counted';

function dayOf(p: OwnerPayment): string {
  const raw = p.completed_at ?? p.initiated_at;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? String(raw).slice(0, 10) : toISODate(d);
}

function readCounted(): Set<string> {
  try {
    const raw = localStorage.getItem(COUNTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function toCsv(rows: OwnerPayment[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Date', 'Turf', 'Amount', 'Collected by', 'Reference', 'Booking date'];
  const lines = rows.map((p) =>
    [
      dayOf(p),
      p.turf_name,
      p.amount,
      p.collector_phone,
      p.cash_reference,
      p.booking_date?.slice(0, 10),
    ]
      .map(esc)
      .join(','),
  );
  return [header.map(esc).join(','), ...lines].join('\n');
}

// Payments & Cash Reconciliation (module 2.12, PRD §9.2 / §30.9). Every
// payment at the owner's turfs, plus a cash view that groups what staff and
// captains collected by day and by person, so the owner can match it against
// the cash actually handed over. "Counted" ticks are a personal checklist
// kept in this browser only — they are not sent to the server.
export default function OwnerPaymentsPage() {
  const [payments, setPayments] = useState<OwnerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('all');
  const [span, setSpan] = useState<Window>('30');
  const [counted, setCounted] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCounted(readCounted());
    apiClient
      .getOwnerPayments()
      .then((res) => setPayments(res.results))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const inWindow = useMemo(() => {
    if (span === 'all') return payments;
    const since = addDays(todayISO(), -Number(span));
    return payments.filter((p) => dayOf(p) >= since);
  }, [payments, span]);

  const success = inWindow.filter((p) => p.payment_status === 'SUCCESS');
  const total = success.reduce((s, p) => s + Number(p.amount), 0);
  const cashRows = success.filter((p) => p.payment_method === 'CASH');
  const cash = cashRows.reduce((s, p) => s + Number(p.amount), 0);
  const refunded = inWindow
    .filter((p) => p.payment_status === 'REFUNDED')
    .reduce((s, p) => s + Number(p.amount), 0);

  const byDay = useMemo(() => {
    const days = new Map<string, Map<string, OwnerPayment[]>>();
    for (const p of cashRows) {
      const day = dayOf(p);
      const who = p.collector_phone ?? 'Unknown collector';
      const perDay = days.get(day) ?? new Map<string, OwnerPayment[]>();
      perDay.set(who, [...(perDay.get(who) ?? []), p]);
      days.set(day, perDay);
    }
    return [...days.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [cashRows]);

  function toggleCounted(id: string) {
    setCounted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(COUNTED_KEY, JSON.stringify([...next]));
      } catch {
        // Private mode / storage full: the tick still works for this session.
      }
      return next;
    });
  }

  function exportCsv() {
    const blob = new Blob([toCsv(cashRows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bfam-cash-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div data-testid="owner-payments-page">
      <PageHeader
        title="Payments"
        subtitle="Digital and cash payments across your turfs, with a cash reconciliation view."
        action={
          view === 'cash' && cashRows.length > 0 ? (
            <Button variant="secondary" icon={Download} onClick={exportCsv} testID="export-cash">
              Export cash CSV
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        <StatTile
          label="Collected"
          value={total}
          prefix="₹"
          icon={Wallet}
          tone="brand"
          delay={0.05}
          hint="Successful payments"
        />
        <StatTile
          label="Cash"
          value={cash}
          prefix="₹"
          icon={Banknote}
          delay={0.1}
          hint={`${cashRows.length} cash payment${cashRows.length === 1 ? '' : 's'}`}
        />
        <StatTile
          label="Digital"
          value={total - cash}
          prefix="₹"
          icon={CreditCard}
          delay={0.15}
          hint="UPI & gateway"
        />
        <StatTile
          label="Refunded"
          value={refunded}
          prefix="₹"
          icon={RotateCcw}
          delay={0.2}
          hint="Returned to players"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <SegmentedControl<View>
          testIDPrefix="payments-view"
          value={view}
          onChange={setView}
          options={[
            { value: 'all', label: 'All payments', count: inWindow.length },
            { value: 'cash', label: 'Cash reconciliation', count: cashRows.length },
          ]}
        />
        <SegmentedControl<Window>
          testIDPrefix="payments-window"
          value={span}
          onChange={setSpan}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : view === 'all' ? (
        <DataTable
          rows={inWindow}
          keyField="payment_id"
          emptyMessage="No payments recorded yet."
          columns={[
            { key: 'initiated_at', label: 'Date', render: (r) => formatDay(dayOf(r)) },
            { key: 'turf_name', label: 'Turf' },
            { key: 'payment_method', label: 'Method' },
            { key: 'amount', label: 'Amount', render: (r) => formatRupees(r.amount) },
            {
              key: 'payment_status',
              label: 'Status',
              render: (r) => (
                <StatusPill
                  tone={
                    r.payment_status === 'SUCCESS'
                      ? 'success'
                      : r.payment_status === 'FAILED'
                        ? 'danger'
                        : r.payment_status === 'REFUNDED'
                          ? 'info'
                          : 'warning'
                  }
                  label={r.payment_status}
                />
              ),
            },
          ]}
        />
      ) : byDay.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No cash collected"
          message="No cash payments in this window. Cash recorded by staff or captains will be grouped here by day and by person."
          testID="cash-empty"
        />
      ) : (
        <div className="space-y-6" data-testid="cash-reconciliation">
          {byDay.map(([day, collectors], dayIndex) => {
            const dayTotal = [...collectors.values()]
              .flat()
              .reduce((s, p) => s + Number(p.amount), 0);
            const dayRows = [...collectors.values()].flat();
            const allCounted = dayRows.every((p) => counted.has(p.payment_id));
            return (
              <motion.section
                key={day}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(dayIndex, 6) * 0.05, ease: EASE_OUT }}
                className="overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
                data-testid={`cash-day-${day}`}
              >
                <header className="flex items-center justify-between gap-4 border-b border-border-subtle bg-ink-black/[0.025] px-5 py-4">
                  <div>
                    <h2 className="font-ui text-card-title font-bold text-ink-black">
                      {formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h2>
                    <p className="font-ui text-body text-text-tertiary">
                      {dayRows.length} payment{dayRows.length === 1 ? '' : 's'} · {collectors.size}{' '}
                      collector{collectors.size === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {allCounted && <StatusPill tone="success" label="All counted" />}
                    <p className="font-display text-[30px] leading-none text-ink-black">
                      {formatRupees(dayTotal)}
                    </p>
                  </div>
                </header>
                <div className="divide-y divide-border-subtle">
                  {[...collectors.entries()].map(([who, rows]) => (
                    <div key={who} className="px-5 py-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-ui text-body font-semibold text-ink-black">{who}</p>
                        <p className="font-ui text-body font-bold text-brand-red">
                          {formatRupees(rows.reduce((s, p) => s + Number(p.amount), 0))}
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {rows.map((p) => {
                          const isCounted = counted.has(p.payment_id);
                          return (
                            <li key={p.payment_id}>
                              <label
                                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors duration-200 ${
                                  isCounted
                                    ? 'border-brand-red/30 bg-brand-red/[0.04]'
                                    : 'border-border-subtle hover:border-border-strong'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isCounted}
                                  onChange={() => toggleCounted(p.payment_id)}
                                  data-testid={`counted-${p.payment_id}`}
                                  aria-label={`Mark ${formatRupees(p.amount)} cash as counted`}
                                  className="h-[18px] w-[18px] cursor-pointer accent-[#D80000]"
                                />
                                <span className="flex-1 font-ui text-body text-ink-black">
                                  {formatRupees(p.amount)}
                                  <span className="ml-2 text-[12px] text-text-tertiary">
                                    {p.turf_name}
                                    {p.cash_reference ? ` · ref ${p.cash_reference}` : ''}
                                  </span>
                                </span>
                                {isCounted && (
                                  <CheckCheck className="h-[16px] w-[16px] text-brand-red" />
                                )}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </motion.section>
            );
          })}
          <p className="font-ui text-[12px] text-text-tertiary">
            Ticks are saved in this browser only — they&apos;re a counting aid, not a record on the
            server.
          </p>
        </div>
      )}
    </div>
  );
}
