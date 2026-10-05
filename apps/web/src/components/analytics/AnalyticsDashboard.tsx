'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  Gauge,
  IndianRupee,
  RefreshCw,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { AnalyticsResult, AnalyticsSummary } from '@bfam/shared-types';
import { PageHeader } from '../DashboardShell';
import { addDays, formatDay, formatRupees, todayISO } from '../../lib/dates';
import { AreaChart, BarChart, HBarList } from '../ui/charts';
import { CountUp, EASE_OUT } from '../ui/motion';
import { Button, EmptyState, SegmentedControl, Skeleton } from '../ui/kit';

type Preset = '7' | '30' | '90' | '365';
type Metric = 'revenue' | 'bookings';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
const PRESET_LABEL: Record<Preset, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  '365': 'Last 12 months',
};

// Percent change vs the previous period. `lowerIsBetter` flips the colours for
// metrics like cancellations. Returns null when there is nothing to compare.
function change(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return ((now - before) / before) * 100;
}

function Delta({
  now,
  before,
  lowerIsBetter = false,
}: {
  now: number;
  before: number;
  lowerIsBetter?: boolean;
}) {
  const pct = change(now, before);
  if (pct === null) {
    return (
      <span className="font-ui text-[12px] text-text-tertiary" data-testid="delta">
        New
      </span>
    );
  }
  if (Math.abs(pct) < 0.5) {
    return (
      <span className="font-ui text-[12px] text-text-tertiary" data-testid="delta">
        No change
      </span>
    );
  }
  const up = pct > 0;
  const good = lowerIsBetter ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-[2px] font-ui text-[12px] font-bold ${
        good ? 'text-status-success' : 'text-status-danger'
      }`}
      data-testid="delta"
      data-direction={up ? 'up' : 'down'}
    >
      <Icon className="h-[14px] w-[14px]" />
      {Math.abs(pct).toFixed(pct > 100 ? 0 : 1)}%
    </span>
  );
}

function Kpi({
  label,
  icon: Icon,
  value,
  prefix,
  suffix,
  now,
  before,
  lowerIsBetter,
  delay,
  hint,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  prefix?: string;
  suffix?: string;
  now: number;
  before: number;
  lowerIsBetter?: boolean;
  delay: number;
  hint?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
      whileHover={reduce ? undefined : { y: -3 }}
      className="group relative overflow-hidden rounded-lg border border-border-subtle bg-surface p-5 transition-shadow duration-300 hover:shadow-[0_14px_34px_rgba(0,0,0,0.08)]"
      data-testid={`kpi-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
    >
      <span
        aria-hidden
        className="absolute -right-6 -top-6 h-[96px] w-[96px] rounded-[999px] bg-brand-red/[0.07] transition-transform duration-500 group-hover:scale-125"
      />
      <div className="relative flex items-start justify-between">
        <p className="font-ui text-micro uppercase tracking-wider text-text-tertiary">{label}</p>
        <span className="grid h-[34px] w-[34px] place-items-center rounded-md bg-brand-red/10 text-brand-red">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="relative mt-3 font-display text-[40px] leading-none tracking-wide">
        <CountUp value={Math.round(value)} prefix={prefix} suffix={suffix} />
      </p>
      <p className="relative mt-2 flex items-center gap-2">
        <Delta now={now} before={before} lowerIsBetter={lowerIsBetter} />
        <span className="font-ui text-[12px] text-text-tertiary">
          {hint ?? 'vs previous period'}
        </span>
      </p>
    </motion.div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  testID,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <section
      className="rounded-lg border border-border-subtle bg-surface p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
      data-testid={testID}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-ui text-card-title font-bold text-ink-black">{title}</h2>
          {subtitle && <p className="font-ui text-body text-text-tertiary">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Shared analytics dashboard behind Owner → Analytics and Admin → Analytics.
// `load` fetches for a date range (and optional turf); everything else is
// presentation. Revenue = booking value of non-cancelled bookings; occupancy =
// booked time / opening hours — both stated under the figures.
export function AnalyticsDashboard({
  title,
  subtitle,
  load,
  turfs,
  platform = false,
}: {
  title: string;
  subtitle: string;
  load: (filters: { from: string; to: string; turf_id?: string }) => Promise<AnalyticsResult>;
  /** When given, shows a turf filter (owners with several turfs). */
  turfs?: { turf_id: string; turf_name: string }[];
  platform?: boolean;
}) {
  const [preset, setPreset] = useState<Preset>('30');
  const [metric, setMetric] = useState<Metric>('revenue');
  const [turfId, setTurfId] = useState('');
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const to = todayISO();
      const from = addDays(to, -(Number(preset) - 1));
      try {
        setData(await load({ from, to, ...(turfId ? { turf_id: turfId } : {}) }));
      } catch (err) {
        setData(null);
        setError(err instanceof BFAMApiError ? err.message : 'Could not load analytics.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load, preset, turfId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const s: AnalyticsSummary | undefined = data?.summary;
  const p: AnalyticsSummary | undefined = data?.previous;
  const empty = !!data && data.summary.bookings === 0;

  const daily = (data?.daily ?? []).map((d) => ({
    label: formatDay(d.date, { day: 'numeric', month: 'short' }),
    value: metric === 'revenue' ? d.revenue : d.bookings,
  }));
  const fmt =
    metric === 'revenue' ? formatRupees : (n: number) => `${n} booking${n === 1 ? '' : 's'}`;

  return (
    <div data-testid="analytics-page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-3">
            {turfs && turfs.length > 1 && (
              <select
                aria-label="Filter by turf"
                value={turfId}
                onChange={(e) => setTurfId(e.target.value)}
                data-testid="analytics-turf"
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
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => fetchData(true)}
              testID="analytics-refresh"
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <SegmentedControl<Preset>
          testIDPrefix="range"
          value={preset}
          onChange={setPreset}
          options={(['7', '30', '90', '365'] as Preset[]).map((v) => ({
            value: v,
            label: v === '365' ? '12M' : `${v}D`,
          }))}
        />
        <p className="font-ui text-body text-text-tertiary">
          {PRESET_LABEL[preset]}
          {data &&
            ` · ${formatDay(data.range.from, { day: 'numeric', month: 'short' })} – ${formatDay(data.range.to, { day: 'numeric', month: 'short' })}`}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          data-testid="analytics-error"
          className="mb-4 font-ui text-body text-brand-red"
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-4" data-testid="analytics-loading">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px]" />
            ))}
          </div>
          <Skeleton className="h-[320px]" />
        </div>
      ) : !data || !s || !p ? null : empty ? (
        <EmptyState
          icon={BarChart3}
          title="No bookings in this period"
          message="Pick a longer range, or check back once bookings come in."
          testID="analytics-empty"
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Kpi
              label="Revenue"
              icon={IndianRupee}
              prefix="₹"
              value={s.revenue}
              now={s.revenue}
              before={p.revenue}
              delay={0}
            />
            <Kpi
              label="Bookings"
              icon={CalendarCheck}
              value={s.bookings}
              now={s.bookings}
              before={p.bookings}
              delay={0.05}
            />
            <Kpi
              label="Occupancy"
              icon={Gauge}
              suffix="%"
              value={s.occupancy_pct}
              now={s.occupancy_pct}
              before={p.occupancy_pct}
              delay={0.1}
            />
            <Kpi
              label="Avg booking"
              icon={Activity}
              prefix="₹"
              value={s.avg_booking_value}
              now={s.avg_booking_value}
              before={p.avg_booking_value}
              delay={0.15}
            />
            <Kpi
              label="Collected"
              icon={Wallet}
              prefix="₹"
              value={s.collected}
              now={s.collected}
              before={p.collected}
              delay={0.2}
              hint={`₹${Math.round(s.outstanding).toLocaleString('en-IN')} still due`}
            />
            <Kpi
              label="Cancellation rate"
              icon={XCircle}
              suffix="%"
              value={s.cancellation_rate}
              now={s.cancellation_rate}
              before={p.cancellation_rate}
              lowerIsBetter
              delay={0.25}
              hint={`${s.cancelled} cancelled`}
            />
            <Kpi
              label="Customers"
              icon={Users}
              value={s.unique_customers}
              now={s.unique_customers}
              before={p.unique_customers}
              delay={0.3}
            />
            <Kpi
              label="New customers"
              icon={UserPlus}
              value={s.new_customers}
              now={s.new_customers}
              before={p.new_customers}
              delay={0.35}
            />
          </div>

          <Panel
            title={metric === 'revenue' ? 'Revenue over time' : 'Bookings over time'}
            subtitle="Non-cancelled bookings, by booking date."
            testID="panel-trend"
            action={
              <SegmentedControl<Metric>
                testIDPrefix="metric"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'revenue', label: 'Revenue' },
                  { value: 'bookings', label: 'Bookings' },
                ]}
              />
            }
          >
            <AreaChart
              points={daily}
              format={fmt}
              testID="chart-trend"
              ariaLabel={`${metric === 'revenue' ? 'Revenue' : 'Bookings'} per day`}
            />
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Peak hours" subtitle="When bookings start." testID="panel-hours">
              <BarChart
                bars={data.peak_hours.map((h) => ({ label: hourLabel(h.hour), value: h.bookings }))}
                format={(n) => `${n} booking${n === 1 ? '' : 's'}`}
                testID="chart-hours"
                ariaLabel="Bookings by start hour"
              />
            </Panel>
            <Panel
              title="Busiest days"
              subtitle="Bookings by day of the week."
              testID="panel-weekday"
            >
              <BarChart
                bars={data.by_weekday.map((d) => ({ label: DOW[d.dow], value: d.bookings }))}
                format={(n) => `${n} booking${n === 1 ? '' : 's'}`}
                testID="chart-weekday"
                ariaLabel="Bookings by day of week"
              />
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel
              title={platform ? 'Top turfs' : 'Your turfs'}
              subtitle="Ranked by revenue."
              testID="panel-turfs"
            >
              {data.by_turf.length === 0 ? (
                <p className="font-ui text-body text-text-tertiary">No turfs yet.</p>
              ) : (
                <HBarList
                  testID="turf-ranking"
                  rows={data.by_turf.slice(0, 8).map((t) => ({
                    label: t.turf_name,
                    value: t.revenue,
                    hint: `${t.bookings} bookings · ${t.occupancy_pct}% full`,
                  }))}
                  format={formatRupees}
                />
              )}
            </Panel>
            <Panel title="How people pay" subtitle="Bookings by payment mode." testID="panel-modes">
              {data.payment_modes.length === 0 ? (
                <p className="font-ui text-body text-text-tertiary">No payments yet.</p>
              ) : (
                <HBarList
                  testID="payment-modes"
                  rows={data.payment_modes.map((m) => ({
                    label: m.mode
                      .replace(/_/g, ' ')
                      .toLowerCase()
                      .replace(/^./, (c) => c.toUpperCase()),
                    value: m.bookings,
                  }))}
                  format={(n) => `${n}`}
                />
              )}
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {platform && data.growth && (
              <Panel title="New players" subtitle="Sign-ups per day." testID="panel-growth">
                <AreaChart
                  points={data.growth.map((g) => ({
                    label: formatDay(g.date, { day: 'numeric', month: 'short' }),
                    value: g.new_players,
                  }))}
                  format={(n) => `${n} new`}
                  height={200}
                  testID="chart-growth"
                  ariaLabel="New players per day"
                />
              </Panel>
            )}
            <Panel
              title="Attendance"
              subtitle="Players who didn’t show for their match."
              testID="panel-noshows"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-[48px] w-[48px] place-items-center rounded-md bg-brand-red/10 text-brand-red">
                  <UserMinus className="h-[24px] w-[24px]" />
                </span>
                <div>
                  <p
                    className="font-display text-[40px] leading-none text-ink-black"
                    data-testid="no-shows"
                  >
                    <CountUp value={s.no_shows} />
                  </p>
                  <p className="font-ui text-body text-text-tertiary">
                    no-shows · <Delta now={s.no_shows} before={p.no_shows} lowerIsBetter />
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          <p className="font-ui text-micro text-text-tertiary">
            Revenue is the booking value of non-cancelled bookings. Occupancy is booked time divided
            by opening hours. “Previous period” is the same number of days just before this range.
          </p>
        </div>
      )}
    </div>
  );
}
