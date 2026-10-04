'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  Hash,
  IndianRupee,
  LifeBuoy,
  MapPin,
  RefreshCw,
  ScrollText,
  Swords,
  Ticket,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AdminOverview } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { humanize, timeAgo } from '../../lib/dates';
import { PageHeader } from '../../components/DashboardShell';
import { EASE_OUT, FadeIn } from '../../components/ui/motion';
import { Button, EmptyState, SkeletonRows, StatTile } from '../../components/ui/kit';

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// Admin Overview (PRD §9.1 / §30.10) — the platform at a glance, what needs
// attention first, a shortcut into each console area and the latest admin
// and system activity.
export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      setData(await apiClient.getAdminOverview());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const attention = data
    ? [
        {
          key: 'open',
          label: 'Open support tickets',
          value: data.support.open,
          href: '/admin/support',
          icon: LifeBuoy,
        },
        {
          key: 'progress',
          label: 'Tickets in progress',
          value: data.support.in_progress,
          href: '/admin/support',
          icon: Activity,
        },
        {
          key: 'ids',
          label: 'BFAM IDs held in reserve',
          value: data.bfam_ids.locked,
          href: '/admin/bfam-ids',
          icon: Hash,
        },
      ]
    : [];

  const shortcuts = [
    {
      href: '/admin/support',
      label: 'Support queue',
      hint: 'Complaints, disputes, injuries',
      icon: LifeBuoy,
    },
    { href: '/admin/promos', label: 'Promo codes', hint: 'Create and switch offers', icon: Ticket },
    { href: '/admin/bfam-ids', label: 'BFAM IDs', hint: 'Reserve and assign IDs', icon: Hash },
    { href: '/admin/audit', label: 'Audit log', hint: 'Every sensitive change', icon: ScrollText },
    { href: '/admin/turfs', label: 'Turfs', hint: 'Suspend or reactivate', icon: MapPin },
    { href: '/admin/reports', label: 'Reports', hint: 'Revenue and bookings', icon: IndianRupee },
  ];

  return (
    <div data-testid="admin-overview-page">
      <PageHeader
        title="Overview"
        subtitle="The whole platform at a glance."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => load(true)}
            testID="overview-refresh"
          >
            Refresh
          </Button>
        }
      />

      <FadeIn>
        <div className="bfam-hero relative overflow-hidden rounded-lg px-7 py-6 text-white mb-7 shadow-[0_18px_40px_rgba(216,0,0,0.25)]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-[30%] bg-white/10 animate-sheen"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -bottom-16 select-none font-display text-[180px] leading-none text-white/[0.07] animate-drift-x"
          >
            BFAM
          </span>
          <div className="relative">
            <p className="font-ui text-micro uppercase tracking-[0.2em] text-white/70">
              {greeting(new Date())}, admin
            </p>
            <p className="font-display text-[34px] leading-tight tracking-wide uppercase">
              {data
                ? `${data.bookings.today} booking${data.bookings.today === 1 ? '' : 's'} today · ${data.matches.live} live match${data.matches.live === 1 ? '' : 'es'}`
                : 'Control room'}
            </p>
          </div>
        </div>
      </FadeIn>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : failed || !data ? (
        <EmptyState
          icon={Activity}
          title="Couldn't load the overview"
          message="Your session may have expired — try refreshing or logging in again."
          testID="overview-error"
          action={<Button onClick={() => load()}>Try again</Button>}
        />
      ) : (
        <>
          <div className="mb-7 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile
              label="Players"
              value={data.users.players}
              icon={Users}
              tone="brand"
              delay={0.05}
              hint={`${data.users.new_players_7d} new this week`}
            />
            <StatTile
              label="Turf owners"
              value={data.users.owners}
              icon={UserPlus}
              delay={0.1}
              hint={`${data.users.staff} staff`}
            />
            <StatTile
              label="Active turfs"
              value={data.turfs.active}
              icon={MapPin}
              delay={0.15}
              hint={`of ${data.turfs.total} listed`}
            />
            <StatTile
              label="Bookings today"
              value={data.bookings.today}
              icon={CalendarCheck}
              delay={0.2}
              hint={`${data.bookings.last_7_days} in the last 7 days`}
            />
            <StatTile
              label="Revenue (30 days)"
              value={data.revenue.last_30_days}
              prefix="₹"
              icon={IndianRupee}
              delay={0.25}
              hint="Successful payments"
            />
            <StatTile
              label="Live matches"
              value={data.matches.live}
              icon={Swords}
              delay={0.3}
              hint={`${data.matches.upcoming} upcoming`}
            />
            <StatTile
              label="Open tickets"
              value={data.support.open}
              icon={LifeBuoy}
              delay={0.35}
              hint={`${data.support.in_progress} in progress`}
            />
            <StatTile
              label="Reserved IDs"
              value={data.bfam_ids.locked}
              icon={Hash}
              delay={0.4}
              hint="Held for assignment"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6">
              <section aria-label="Needs attention">
                <h2 className="mb-3 font-ui text-micro uppercase tracking-[0.16em] text-text-secondary">
                  Needs attention
                </h2>
                <ul className="space-y-2">
                  {attention.map((a, i) => (
                    <motion.li
                      key={a.key}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 * i, ease: EASE_OUT }}
                    >
                      <Link
                        href={a.href}
                        data-testid={`attention-${a.key}`}
                        className="group flex items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4 transition-all duration-300 hover:border-brand-red/40 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
                      >
                        <span
                          className={`grid h-[40px] w-[40px] place-items-center rounded-md ${
                            a.value > 0
                              ? 'bg-brand-red/10 text-brand-red'
                              : 'bg-ink-black/[0.05] text-text-tertiary'
                          }`}
                        >
                          <a.icon className="h-[20px] w-[20px]" />
                        </span>
                        <span className="flex-1 font-ui text-body font-semibold text-ink-black">
                          {a.label}
                        </span>
                        <span className="font-display text-[28px] leading-none text-ink-black">
                          {a.value}
                        </span>
                        <ArrowRight className="h-[18px] w-[18px] text-text-tertiary transition-transform group-hover:translate-x-1 group-hover:text-brand-red" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </section>

              <section aria-label="Shortcuts">
                <h2 className="mb-3 font-ui text-micro uppercase tracking-[0.16em] text-text-secondary">
                  Jump to
                </h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {shortcuts.map((s, i) => (
                    <motion.div
                      key={s.href}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.05 * i, ease: EASE_OUT }}
                      whileHover={{ y: -3 }}
                    >
                      <Link
                        href={s.href}
                        className="group block h-full rounded-lg border border-border-subtle bg-surface p-4 transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
                      >
                        <s.icon className="h-[22px] w-[22px] text-brand-red transition-transform duration-300 group-hover:scale-110" />
                        <p className="mt-3 font-ui text-body font-bold text-ink-black">{s.label}</p>
                        <p className="font-ui text-[12px] text-text-tertiary">{s.hint}</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </section>
            </div>

            <section aria-label="Recent activity">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-ui text-micro uppercase tracking-[0.16em] text-text-secondary">
                  Recent activity
                </h2>
                <Link
                  href="/admin/audit"
                  className="font-ui text-[13px] font-bold text-brand-red hover:underline"
                >
                  View all
                </Link>
              </div>
              {data.recent_activity.length === 0 ? (
                <EmptyState
                  icon={ScrollText}
                  title="Nothing yet"
                  message="Cancellations, ticket changes and other admin actions will show up here."
                  testID="activity-empty"
                />
              ) : (
                <ol
                  className="relative space-y-1 rounded-lg border border-border-subtle bg-surface p-4"
                  data-testid="activity-feed"
                >
                  <span
                    aria-hidden
                    className="absolute left-[27px] top-6 bottom-6 w-px bg-border-strong"
                  />
                  {data.recent_activity.map((a, i) => (
                    <motion.li
                      key={a.log_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.06 * i, ease: EASE_OUT }}
                      className="relative flex gap-4 py-2"
                    >
                      <span className="relative z-[1] mt-[6px] h-[11px] w-[11px] shrink-0 rounded-[999px] border-2 border-surface bg-brand-red" />
                      <div className="min-w-0 flex-1">
                        <p className="font-ui text-body font-semibold text-ink-black">
                          {humanize(a.action)}
                        </p>
                        <p className="font-ui text-[12px] text-text-tertiary truncate">
                          {a.resource_type.replace(/_/g, ' ')} ·{' '}
                          {a.actor_phone ?? a.actor_role ?? 'system'}
                        </p>
                      </div>
                      <span className="shrink-0 font-ui text-[12px] text-text-tertiary">
                        {timeAgo(a.created_at)}
                      </span>
                    </motion.li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
