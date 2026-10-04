'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  LifeBuoy,
  MessageSquare,
  Phone,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Swords,
  XCircle,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { AdminTicket, DisputeType, SupportStatus } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { humanize, timeAgo } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../components/ui/Drawer';
import { EASE_OUT } from '../../../components/ui/motion';
import { useToast } from '../../../components/ui/Toast';
import {
  Button,
  EmptyState,
  SearchInput,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

type StatusTab = 'ALL' | SupportStatus;
type TypeFilter = 'ALL' | DisputeType;

const STATUS_TONE: Record<SupportStatus, Tone> = {
  OPEN: 'danger',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const TYPE_META: Record<DisputeType, { label: string; icon: typeof MessageSquare }> = {
  COMPLAINT: { label: 'Complaint', icon: MessageSquare },
  MATCH_DISPUTE: { label: 'Match dispute', icon: Swords },
  INJURY_REPORT: { label: 'Injury report', icon: AlertTriangle },
};

// Mirrors the server's state machine (domain/supportTicket.ts); the server is
// still the one that enforces it.
const NEXT_STEPS: Record<
  SupportStatus,
  {
    to: SupportStatus;
    label: string;
    icon: typeof PlayCircle;
    primary?: boolean;
    confirm?: boolean;
  }[]
> = {
  OPEN: [
    { to: 'IN_PROGRESS', label: 'Start working', icon: PlayCircle, primary: true },
    { to: 'CLOSED', label: 'Close', icon: XCircle, confirm: true },
  ],
  IN_PROGRESS: [
    { to: 'RESOLVED', label: 'Mark resolved', icon: CheckCircle2, primary: true },
    { to: 'CLOSED', label: 'Close', icon: XCircle, confirm: true },
  ],
  RESOLVED: [
    { to: 'CLOSED', label: 'Close', icon: XCircle, primary: true, confirm: true },
    { to: 'IN_PROGRESS', label: 'Reopen', icon: RotateCcw },
  ],
  CLOSED: [],
};

function who(t: AdminTicket): string {
  return t.raised_by_name || t.raised_by_bfam_id || t.raised_by_phone || 'Unknown user';
}

// Support queue (PRD §9.1 "complaint handling", module 2.13) — every
// complaint, match dispute and injury report, oldest-open first, with the
// status workflow. Moving a ticket notifies the player who raised it.
export default function AdminSupportPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [counts, setCounts] = useState<Record<SupportStatus, number>>({
    OPEN: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<StatusTab>('ALL');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<AdminTicket | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiClient.getAdminTickets();
      setTickets(res.results);
      setCounts(res.counts);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = counts.OPEN + counts.IN_PROGRESS + counts.RESOLVED + counts.CLOSED;
  const open = tickets.find((t) => t.ticket_id === openId) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (tab !== 'ALL' && t.status !== tab) return false;
      if (type !== 'ALL' && t.dispute_type !== type) return false;
      if (!q) return true;
      return [t.description, t.raised_by_name, t.raised_by_phone, t.raised_by_bfam_id, t.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [tickets, tab, type, query]);

  async function move(ticket: AdminTicket, to: SupportStatus) {
    setSaving(true);
    try {
      await apiClient.updateTicketStatus(ticket.ticket_id, to);
      toast.success(`Ticket ${humanize(to).toLowerCase()} — the player was notified`);
      setPendingClose(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not update the ticket.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-testid="admin-support-page">
      <PageHeader
        title="Support"
        subtitle="Complaints, match disputes and injury reports. Moving a ticket notifies the player."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => load(true)}
            testID="support-refresh"
          >
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <SegmentedControl<StatusTab>
          testIDPrefix="ticket-status"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ALL', label: 'All', count: total },
            { value: 'OPEN', label: 'Open', count: counts.OPEN },
            { value: 'IN_PROGRESS', label: 'In progress', count: counts.IN_PROGRESS },
            { value: 'RESOLVED', label: 'Resolved', count: counts.RESOLVED },
            { value: 'CLOSED', label: 'Closed', count: counts.CLOSED },
          ]}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TypeFilter)}
          aria-label="Filter by type"
          data-testid="ticket-type"
          className="h-[42px] cursor-pointer rounded-md border border-border-strong bg-surface px-3 font-ui text-body text-text-primary hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]"
        >
          <option value="ALL">All types</option>
          <option value="COMPLAINT">Complaints</option>
          <option value="MATCH_DISPUTE">Match disputes</option>
          <option value="INJURY_REPORT">Injury reports</option>
        </select>
        <div className="ml-auto w-full max-w-[340px]">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search description, player or phone"
            ariaLabel="Search tickets"
            testID="ticket-search"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={total === 0 ? 'Inbox zero' : 'Nothing here'}
          message={
            total === 0
              ? 'No support tickets have been raised yet.'
              : 'No tickets match these filters.'
          }
          testID="tickets-empty"
        />
      ) : (
        <ul className="space-y-3" data-testid="ticket-list">
          {visible.map((t, index) => {
            const meta = TYPE_META[t.dispute_type];
            return (
              <motion.li
                key={t.ticket_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: EASE_OUT }}
              >
                <motion.button
                  type="button"
                  onClick={() => setOpenId(t.ticket_id)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.995 }}
                  data-testid={`ticket-${t.ticket_id}`}
                  aria-label={`Open ticket from ${who(t)}`}
                  className="group relative flex w-full items-start gap-4 overflow-hidden rounded-lg border border-border-subtle bg-surface px-5 py-4 text-left cursor-pointer transition-shadow duration-300 hover:shadow-[0_14px_34px_rgba(0,0,0,0.09)]"
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-[4px] ${t.status === 'OPEN' ? 'bg-brand-red' : 'bg-transparent'}`}
                  />
                  <span
                    className={`mt-[2px] grid h-[40px] w-[40px] shrink-0 place-items-center rounded-md ${
                      t.dispute_type === 'INJURY_REPORT'
                        ? 'bg-brand-red/10 text-brand-red'
                        : 'bg-ink-black/[0.05] text-ink-black'
                    }`}
                  >
                    <meta.icon className="h-[20px] w-[20px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-ui text-body font-bold text-ink-black">{meta.label}</p>
                      <span className="font-ui text-[12px] text-text-tertiary">
                        · {humanize(t.category)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 font-ui text-body text-text-secondary">
                      {t.description}
                    </p>
                    <p className="mt-2 font-ui text-[12px] text-text-tertiary">
                      {who(t)} · {timeAgo(t.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusPill tone={STATUS_TONE[t.status]} label={t.status.replace('_', ' ')} />
                    <ChevronRight className="h-[18px] w-[18px] text-text-tertiary transition-transform group-hover:translate-x-1 group-hover:text-brand-red" />
                  </div>
                </motion.button>
              </motion.li>
            );
          })}
        </ul>
      )}

      <Drawer
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open ? TYPE_META[open.dispute_type].label : 'Ticket'}
        subtitle={open ? `${humanize(open.category)} · ${timeAgo(open.created_at)}` : undefined}
        testID="ticket-drawer"
      >
        {open && (
          <div data-testid="ticket-detail">
            <div className="mb-5 flex items-center gap-3">
              <StatusPill tone={STATUS_TONE[open.status]} label={open.status.replace('_', ' ')} />
              {open.resolved_at && (
                <span className="font-ui text-[12px] text-text-tertiary">
                  Resolved {timeAgo(open.resolved_at)}
                </span>
              )}
            </div>

            <section className="mb-5 rounded-lg border border-border-subtle p-4">
              <h3 className="mb-2 font-ui text-micro uppercase tracking-wider text-text-tertiary">
                What happened
              </h3>
              <p className="whitespace-pre-wrap font-ui text-body leading-relaxed text-ink-black">
                {open.description}
              </p>
              {open.related_entity_type && (
                <p className="mt-3 font-ui text-[12px] text-text-tertiary">
                  Related {open.related_entity_type.replace(/_/g, ' ')} ·{' '}
                  {open.related_entity_id?.slice(0, 8)}…
                </p>
              )}
            </section>

            <section className="mb-6 rounded-lg border border-border-subtle p-4">
              <h3 className="mb-2 font-ui text-micro uppercase tracking-wider text-text-tertiary">
                Raised by
              </h3>
              <p className="font-ui text-card-title font-bold text-ink-black">{who(open)}</p>
              {open.raised_by_bfam_id && (
                <p className="font-ui text-body text-text-secondary">{open.raised_by_bfam_id}</p>
              )}
              {open.raised_by_phone && (
                <a
                  href={`tel:${open.raised_by_phone}`}
                  data-testid="ticket-phone"
                  className="mt-1 inline-flex items-center gap-1 font-ui text-body text-brand-red hover:underline"
                >
                  <Phone className="h-[14px] w-[14px]" /> {open.raised_by_phone}
                </a>
              )}
            </section>

            {NEXT_STEPS[open.status].length === 0 ? (
              <p className="font-ui text-body text-text-tertiary">This ticket is closed.</p>
            ) : (
              <div className="flex flex-wrap gap-3 border-t border-border-subtle pt-5">
                {NEXT_STEPS[open.status].map((step) => (
                  <Button
                    key={step.to}
                    variant={step.primary ? 'primary' : 'secondary'}
                    icon={step.icon}
                    loading={saving && !pendingClose}
                    onClick={() => (step.confirm ? setPendingClose(open) : move(open, step.to))}
                    testID={`ticket-to-${step.to}`}
                  >
                    {step.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={pendingClose !== null}
        title="Close this ticket?"
        message="Closing is final — the ticket can't be reopened, and the player is told it's closed."
        confirmLabel="Close ticket"
        cancelLabel="Keep open"
        busy={saving}
        onCancel={() => setPendingClose(null)}
        onConfirm={() => pendingClose && move(pendingClose, 'CLOSED')}
        testID="close-ticket-dialog"
      />
    </div>
  );
}
