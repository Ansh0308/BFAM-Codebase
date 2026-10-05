'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Phone, UserX, Users } from 'lucide-react';
import type { CustomerSegment, OwnerCustomer, OwnerCustomerDetail, Turf } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { formatDay, formatRupees, hhmm } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { Drawer } from '../../../components/ui/Drawer';
import { EASE_OUT } from '../../../components/ui/motion';
import {
  Avatar,
  EmptyState,
  SearchInput,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

type Filter = 'ALL' | CustomerSegment;
type Sort = 'spend' | 'visits' | 'recent';

const SEGMENT_TONE: Record<CustomerSegment, Tone> = {
  NEW: 'info',
  REGULAR: 'success',
  LAPSED: 'warning',
  OCCASIONAL: 'neutral',
};
const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  NEW: 'New',
  REGULAR: 'Regular',
  LAPSED: 'Lapsed',
  OCCASIONAL: 'Occasional',
};
const SEGMENT_HINT: Record<CustomerSegment, string> = {
  NEW: 'First booking in the last 30 days',
  REGULAR: '3+ visits, one in the last 60 days',
  LAPSED: 'No booking for 60+ days',
  OCCASIONAL: 'Everyone in between',
};

const BOOKING_TONE: Record<string, Tone> = {
  CONFIRMED: 'success',
  COMPLETED: 'info',
  PENDING: 'warning',
  CANCELLED: 'neutral',
};

const nameOf = (c: OwnerCustomer) => c.name || c.phone_number;

// Customers (OW-5, PRD §9.2): the players who book at the owner's turfs, with
// what they spend and how often they come back. Only name, phone and their
// history at THIS owner's turfs are shown.
export default function OwnerCustomersPage() {
  const [customers, setCustomers] = useState<OwnerCustomer[]>([]);
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [turfId, setTurfId] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>('spend');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<OwnerCustomer | null>(null);
  const [detail, setDetail] = useState<OwnerCustomerDetail | null>(null);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => setTurfs(res.results))
      .catch(() => setTurfs([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getOwnerCustomers(turfId ? { turf_id: turfId } : {});
      setCustomers(res.results);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [turfId]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const by = (s: CustomerSegment) => customers.filter((c) => c.segment === s).length;
    return {
      ALL: customers.length,
      NEW: by('NEW'),
      REGULAR: by('REGULAR'),
      LAPSED: by('LAPSED'),
      OCCASIONAL: by('OCCASIONAL'),
    };
  }, [customers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter(
        (c) =>
          (filter === 'ALL' || c.segment === filter) &&
          (!q || nameOf(c).toLowerCase().includes(q) || c.phone_number.includes(q)),
      )
      .sort((a, b) =>
        sort === 'spend'
          ? b.total_spend - a.total_spend
          : sort === 'visits'
            ? b.visits - a.visits
            : (b.last_booking ?? '').localeCompare(a.last_booking ?? ''),
      );
  }, [customers, filter, query, sort]);

  const totals = useMemo(
    () => ({
      spend: customers.reduce((sum, c) => sum + c.total_spend, 0),
      repeat: customers.filter((c) => c.visits >= 2).length,
    }),
    [customers],
  );

  async function openCustomer(c: OwnerCustomer) {
    setOpen(c);
    setDetail(null);
    try {
      setDetail(await apiClient.getOwnerCustomer(c.user_id));
    } catch {
      setDetail({ customer: c, bookings: [] });
    }
  }

  return (
    <div data-testid="owner-customers-page">
      <PageHeader
        title="Customers"
        subtitle="Players who book at your turfs."
        action={
          turfs.length > 1 ? (
            <select
              aria-label="Filter by turf"
              value={turfId}
              onChange={(e) => setTurfId(e.target.value)}
              data-testid="customers-turf"
              className="h-[40px] rounded-md border border-border-strong bg-surface px-3 font-ui text-body focus:border-brand-red focus:outline-none"
            >
              <option value="">All turfs</option>
              {turfs.map((t) => (
                <option key={t.turf_id} value={t.turf_id}>
                  {t.turf_name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {!loading && customers.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4" data-testid="customer-totals">
          {[
            ['Customers', String(customers.length)],
            [
              'Came back',
              `${totals.repeat} (${Math.round((totals.repeat / customers.length) * 100)}%)`,
            ],
            ['Total spent', formatRupees(totals.spend)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-border-subtle bg-surface px-5 py-4"
            >
              <p className="font-ui text-micro uppercase tracking-wider text-text-tertiary">
                {label}
              </p>
              <p className="font-display text-[32px] leading-none text-ink-black mt-2">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <SegmentedControl<Filter>
          testIDPrefix="segment"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All', count: counts.ALL },
            { value: 'NEW', label: 'New', count: counts.NEW },
            { value: 'REGULAR', label: 'Regular', count: counts.REGULAR },
            { value: 'LAPSED', label: 'Lapsed', count: counts.LAPSED },
            { value: 'OCCASIONAL', label: 'Occasional', count: counts.OCCASIONAL },
          ]}
        />
        <div className="min-w-[240px] flex-1 max-w-sm">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Name or phone"
            ariaLabel="Search customers"
            testID="customer-search"
          />
        </div>
        <select
          aria-label="Sort customers"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          data-testid="customer-sort"
          className="h-[40px] rounded-md border border-border-strong bg-surface px-3 font-ui text-body focus:border-brand-red focus:outline-none"
        >
          <option value="spend">Highest spend</option>
          <option value="visits">Most visits</option>
          <option value="recent">Most recent</option>
        </select>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers here"
          message={
            customers.length === 0
              ? 'Once players book your turfs they will appear here.'
              : 'No customers match this view.'
          }
          testID="customers-empty"
        />
      ) : (
        <ul className="space-y-3" data-testid="customer-list">
          {visible.map((c, index) => (
            <motion.li
              key={c.user_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.03, ease: EASE_OUT }}
            >
              <button
                type="button"
                onClick={() => openCustomer(c)}
                data-testid={`customer-${c.user_id}`}
                className="flex w-full flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4 text-left cursor-pointer transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.07)]"
              >
                <Avatar name={nameOf(c)} size={42} />
                <div className="min-w-[180px] flex-1">
                  <p className="font-ui text-card-title font-bold text-ink-black">{nameOf(c)}</p>
                  <p className="font-ui text-body text-text-tertiary">
                    {c.phone_number}
                    {c.last_booking
                      ? ` · last booked ${formatDay(c.last_booking, { day: 'numeric', month: 'short' })}`
                      : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-ui text-body font-bold text-ink-black">
                    {formatRupees(c.total_spend)}
                  </p>
                  <p className="font-ui text-micro text-text-tertiary">
                    {c.visits} visit{c.visits === 1 ? '' : 's'}
                    {c.cancelled > 0 ? ` · ${c.cancelled} cancelled` : ''}
                    {c.no_shows > 0 ? ` · ${c.no_shows} no-show` : ''}
                  </p>
                </div>
                <StatusPill label={SEGMENT_LABEL[c.segment]} tone={SEGMENT_TONE[c.segment]} />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
      <p className="mt-6 font-ui text-micro text-text-tertiary">
        {(Object.keys(SEGMENT_HINT) as CustomerSegment[])
          .map((s) => `${SEGMENT_LABEL[s]}: ${SEGMENT_HINT[s]}`)
          .join(' · ')}
      </p>

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? nameOf(open) : ''}
        subtitle={open?.phone_number}
        testID="customer-drawer"
      >
        {open && (
          <div>
            <div className="mb-5 flex flex-wrap gap-2">
              <StatusPill label={SEGMENT_LABEL[open.segment]} tone={SEGMENT_TONE[open.segment]} />
              {open.no_shows > 0 && (
                <StatusPill
                  label={`${open.no_shows} no-show${open.no_shows === 1 ? '' : 's'}`}
                  tone="danger"
                />
              )}
            </div>
            <a
              href={`tel:${open.phone_number}`}
              className="mb-6 inline-flex items-center gap-2 font-ui text-body font-semibold text-brand-red"
            >
              <Phone className="h-[16px] w-[16px]" /> Call {open.phone_number}
            </a>
            <dl className="mb-6 grid grid-cols-3 gap-3">
              {[
                ['Spent', formatRupees(open.total_spend)],
                ['Visits', String(open.visits)],
                ['Cancelled', String(open.cancelled)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-border-subtle px-4 py-3">
                  <dt className="font-ui text-micro uppercase tracking-wider text-text-tertiary">
                    {k}
                  </dt>
                  <dd className="font-ui text-card-title font-bold text-ink-black">{v}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mb-3 font-ui text-micro uppercase tracking-wider text-text-secondary">
              Bookings at your turfs
            </h3>
            {detail === null ? (
              <SkeletonRows rows={3} />
            ) : detail.bookings.length === 0 ? (
              <p className="flex items-center gap-2 font-ui text-body text-text-tertiary">
                <UserX className="h-[16px] w-[16px]" /> No bookings to show.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="customer-bookings">
                {detail.bookings.map((b) => (
                  <li
                    key={b.booking_id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-4 py-3"
                  >
                    <div>
                      <p className="font-ui text-body font-semibold text-ink-black">
                        {b.turf_name}
                      </p>
                      <p className="font-ui text-micro text-text-tertiary">
                        {formatDay(b.booking_date)} · {hhmm(b.start_time)}–{hhmm(b.end_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-ui text-body font-semibold">
                        {formatRupees(b.booking_amount)}
                      </span>
                      <StatusPill
                        label={b.booking_status}
                        tone={BOOKING_TONE[b.booking_status] ?? 'neutral'}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
