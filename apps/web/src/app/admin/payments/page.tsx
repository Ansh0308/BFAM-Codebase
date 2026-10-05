'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Banknote, Download, RefreshCw, Undo2, Wallet } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { AdminPayment, AdminPaymentSummary, AdminRefund } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { addDays, formatRupees, humanize, todayISO } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { CountUp, EASE_OUT } from '../../../components/ui/motion';
import {
  Button,
  EmptyState,
  SearchInput,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

type View = 'payments' | 'refunds';
type Range = '7' | '30' | '90';

const STATUS_TONE: Record<string, Tone> = {
  SUCCESS: 'success',
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'info',
};

const FIELD =
  'h-[40px] rounded-md border border-border-strong bg-surface px-3 font-ui text-body focus:border-brand-red focus:outline-none';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

function csv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Payment & refund oversight (AW-7, PRD §9.1): every payment (UPI, gateway,
// cash; turf bookings and tournament entry fees), who paid, what it was for and
// any refund against it. Read-only; CSV export for the accounts.
export default function AdminPaymentsPage() {
  const [view, setView] = useState<View>('payments');
  const [range, setRange] = useState<Range>('30');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [summary, setSummary] = useState<AdminPaymentSummary | null>(null);
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const to = todayISO();
    const from = addDays(to, -(Number(range) - 1));
    try {
      if (view === 'payments') {
        const res = await apiClient.getAdminPayments({
          from,
          to,
          ...(status ? { status } : {}),
          ...(method ? { method } : {}),
          ...(kind ? { kind: kind as 'BOOKING' | 'TOURNAMENT_ENTRY' } : {}),
          ...(applied ? { search: applied } : {}),
        });
        setPayments(res.results);
        setSummary(res.summary);
      } else {
        setRefunds((await apiClient.getAdminRefunds({ from, to })).results);
      }
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not load payments.');
    } finally {
      setLoading(false);
    }
  }, [view, range, status, method, kind, applied]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (view === 'payments') {
      download(
        `payments-${todayISO()}.csv`,
        csv([
          ['Date', 'Payer', 'Phone', 'For', 'Method', 'Status', 'Amount', 'Refunded', 'Reference'],
          ...payments.map((p) => [
            when(p.initiated_at),
            p.payer_name ?? '',
            p.payer_phone,
            p.context ?? humanize(p.kind),
            p.payment_method,
            p.payment_status,
            p.amount,
            p.refunded,
            p.reference ?? '',
          ]),
        ]),
      );
    } else {
      download(
        `refunds-${todayISO()}.csv`,
        csv([
          ['Date', 'Payer', 'Phone', 'Reason', 'Status', 'Refunded', 'Payment amount'],
          ...refunds.map((r) => [
            when(r.created_at),
            r.payer_name ?? '',
            r.payer_phone,
            r.reason,
            r.refund_status,
            r.refund_amount,
            r.payment_amount,
          ]),
        ]),
      );
    }
  }

  const tile = (label: string, value: number, icon: typeof Wallet, tone = '') => {
    const Icon = icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4"
        data-testid={`tile-${label.toLowerCase()}`}
      >
        <span
          className={`grid h-[40px] w-[40px] place-items-center rounded-md bg-brand-red/10 text-brand-red ${tone}`}
        >
          <Icon className="h-[20px] w-[20px]" />
        </span>
        <div>
          <p className="font-ui text-micro uppercase tracking-wider text-text-tertiary">{label}</p>
          <p className="font-display text-[30px] leading-none text-ink-black">
            <CountUp value={Math.round(value)} prefix="₹" />
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div data-testid="admin-payments-page">
      <PageHeader
        title="Payments"
        subtitle="Every payment and refund on BFAM."
        action={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              icon={Download}
              onClick={exportCsv}
              disabled={loading}
              testID="export-csv"
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => load()}
              loading={loading}
              testID="payments-refresh"
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <SegmentedControl<View>
          testIDPrefix="pay-view"
          value={view}
          onChange={setView}
          options={[
            { value: 'payments', label: 'Payments' },
            { value: 'refunds', label: 'Refunds' },
          ]}
        />
        <SegmentedControl<Range>
          testIDPrefix="pay-range"
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: '7D' },
            { value: '30', label: '30D' },
            { value: '90', label: '90D' },
          ]}
        />
        {view === 'payments' && (
          <>
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              data-testid="pay-status"
              className={FIELD}
            >
              <option value="">All statuses</option>
              {['SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'].map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
            <select
              aria-label="Method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              data-testid="pay-method"
              className={FIELD}
            >
              <option value="">All methods</option>
              {['UPI', 'RAZORPAY', 'CASH'].map((m) => (
                <option key={m} value={m}>
                  {m === 'RAZORPAY' ? 'Gateway' : humanize(m)}
                </option>
              ))}
            </select>
            <select
              aria-label="For"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              data-testid="pay-kind"
              className={FIELD}
            >
              <option value="">Bookings and tournaments</option>
              <option value="BOOKING">Turf bookings</option>
              <option value="TOURNAMENT_ENTRY">Tournament entry fees</option>
            </select>
            <div className="min-w-[240px] flex-1 max-w-sm">
              <SearchInput
                value={query}
                onChange={setQuery}
                onSubmit={() => setApplied(query.trim())}
                placeholder="Phone, name or reference"
                ariaLabel="Search payments"
                testID="pay-search"
              />
            </div>
          </>
        )}
      </div>

      {view === 'payments' && summary && !loading && (
        <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4" data-testid="payment-summary">
          {tile('Collected', summary.collected, Wallet)}
          {tile('Pending', summary.pending, Banknote)}
          {tile('Failed', summary.failed, Banknote)}
          {tile('Refunded', summary.refunded, Undo2)}
        </div>
      )}
      {view === 'payments' && summary && !loading && summary.by_method.length > 0 && (
        <p className="mb-4 font-ui text-body text-text-tertiary" data-testid="by-method">
          {summary.by_method
            .map(
              (m) =>
                `${m.method === 'RAZORPAY' ? 'Gateway' : humanize(m.method)}: ${m.payments} (${formatRupees(m.amount)})`,
            )
            .join(' · ')}
        </p>
      )}

      {error && (
        <p
          role="alert"
          data-testid="payments-error"
          className="mb-4 font-ui text-body text-brand-red"
        >
          {error}
        </p>
      )}

      {loading ? (
        <SkeletonRows rows={5} />
      ) : view === 'payments' ? (
        payments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payments"
            message="Nothing matches these filters."
            testID="payments-empty"
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
            <table className="min-w-full text-left" data-testid="payments-table">
              <thead>
                <tr className="border-b border-border-subtle bg-ink-black/[0.03] font-ui text-micro uppercase tracking-wide text-text-secondary">
                  {['Date', 'Payer', 'For', 'Method', 'Status', 'Amount', 'Refunded'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 ${h === 'Amount' || h === 'Refunded' ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.payment_id}
                    data-testid={`payment-${p.payment_id}`}
                    className="border-b border-border-subtle last:border-0 hover:bg-brand-red/[0.03]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-ui text-body text-text-secondary">
                      {when(p.initiated_at)}
                    </td>
                    <td className="px-4 py-3 font-ui text-body">
                      <p className="font-semibold text-ink-black">
                        {p.payer_name ?? p.payer_phone}
                      </p>
                      {p.payer_name && (
                        <p className="text-micro text-text-tertiary">{p.payer_phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-ui text-body">
                      <p className="text-ink-black">{p.context ?? '—'}</p>
                      <p className="text-micro text-text-tertiary">
                        {p.kind === 'TOURNAMENT_ENTRY' ? 'Tournament entry' : 'Turf booking'}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-ui text-body">
                      {p.payment_method === 'RAZORPAY' ? 'Gateway' : humanize(p.payment_method)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={p.payment_status}
                        tone={STATUS_TONE[p.payment_status] ?? 'neutral'}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-ui text-body font-bold text-ink-black">
                      {formatRupees(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-ui text-body text-text-secondary">
                      {p.refunded > 0 ? formatRupees(p.refunded) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : refunds.length === 0 ? (
        <EmptyState
          icon={Undo2}
          title="No refunds"
          message="No refunds in this period."
          testID="refunds-empty"
        />
      ) : (
        <ul className="space-y-3" data-testid="refund-list">
          {refunds.map((r) => (
            <li
              key={r.refund_id}
              data-testid={`refund-${r.refund_id}`}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4"
            >
              <div className="min-w-[200px] flex-1">
                <p className="font-ui text-card-title font-bold text-ink-black">
                  {r.payer_name ?? r.payer_phone}
                </p>
                <p className="font-ui text-body text-text-tertiary">
                  {r.reason} · {when(r.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-ui text-body font-bold text-ink-black">
                  {formatRupees(r.refund_amount)}
                </p>
                <p className="font-ui text-micro text-text-tertiary">
                  of {formatRupees(r.payment_amount)}
                </p>
              </div>
              <StatusPill
                label={r.refund_status}
                tone={STATUS_TONE[r.refund_status] ?? 'neutral'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
