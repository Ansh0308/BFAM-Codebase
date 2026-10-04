'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ChevronRight, ClipboardCheck, MapPin, Radio, Swords, Trophy } from 'lucide-react';
import type { MatchPlayer, MatchStatus, OwnerMatch } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader } from '../../../components/DashboardShell';
import { RosterPanel } from '../../../components/staff/RosterPanel';
import { Drawer } from '../../../components/ui/Drawer';
import { EASE_OUT } from '../../../components/ui/motion';
import {
  Button,
  EmptyState,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

type Filter = 'all' | 'live' | 'upcoming' | 'finished';

const STATUS_TONE: Record<MatchStatus, Tone> = {
  OPEN: 'info',
  PENDING: 'warning',
  CONFIRMED: 'success',
  IN_PROGRESS: 'brand',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
};

function bucket(status: MatchStatus): Exclude<Filter, 'all'> {
  if (status === 'IN_PROGRESS') return 'live';
  if (status === 'COMPLETED' || status === 'CANCELLED') return 'finished';
  return 'upcoming';
}

function startLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Match Operations (module 2.12, PRD §8.4/§9.3) — every match at the turf(s)
// this staff member is assigned to, with a desk roster for check-in. Live
// scoring itself stays on the dedicated scoring screen (tap-per-ball is a
// different job from desk work).
export default function StaffMatchesPage() {
  const [matches, setMatches] = useState<OwnerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<OwnerMatch | null>(null);
  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  useEffect(() => {
    apiClient
      .getStaffMatches()
      .then((res) => setMatches(res.results))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  const openRoster = useCallback((m: OwnerMatch) => {
    setOpen(m);
    setPlayers([]);
    setRosterLoading(true);
    apiClient
      .getGameRoom(m.match_id)
      .then((room) => setPlayers(room.players))
      .catch(() => setPlayers([]))
      .finally(() => setRosterLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { live: 0, upcoming: 0, finished: 0 };
    for (const m of matches) c[bucket(m.match_status)] += 1;
    return c;
  }, [matches]);

  const visible = matches.filter((m) => filter === 'all' || bucket(m.match_status) === filter);

  return (
    <div data-testid="staff-matches-page">
      <PageHeader
        title="Match Operations"
        subtitle="Every match at your turfs. Open a roster to check players in."
      />

      <div className="mb-6">
        <SegmentedControl<Filter>
          testIDPrefix="match-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: matches.length },
            { value: 'live', label: 'Live', count: counts.live },
            { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { value: 'finished', label: 'Finished', count: counts.finished },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No matches"
          message={
            matches.length === 0
              ? 'No matches yet at your assigned turf(s).'
              : 'No matches in this view right now.'
          }
          testID="matches-empty"
        />
      ) : (
        <ul className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-testid="match-list">
          {visible.map((m, index) => (
            <motion.li
              key={m.match_id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index, 10) * 0.05, ease: EASE_OUT }}
            >
              <motion.button
                type="button"
                onClick={() => openRoster(m)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.99 }}
                data-testid={`open-roster-${m.match_id}`}
                aria-label={`Open roster for ${m.match_name ?? 'match'}`}
                className={`group relative w-full overflow-hidden text-left rounded-lg border bg-surface p-5 cursor-pointer transition-shadow duration-300 hover:shadow-[0_16px_36px_rgba(0,0,0,0.1)] ${
                  m.match_status === 'IN_PROGRESS'
                    ? 'border-brand-red/40 shadow-[0_8px_26px_rgba(216,0,0,0.12)]'
                    : 'border-border-subtle'
                }`}
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand-red scale-y-0 origin-top transition-transform duration-300 group-hover:scale-y-100"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-ui text-card-title font-bold text-ink-black truncate">
                      {m.match_name ?? 'Match'}
                    </p>
                    <p className="mt-1 flex items-center gap-1 font-ui text-body text-text-tertiary">
                      <MapPin className="h-[14px] w-[14px]" />
                      {m.turf_name}
                    </p>
                  </div>
                  <StatusPill
                    tone={STATUS_TONE[m.match_status]}
                    label={m.match_status.replace('_', ' ')}
                    pulse={m.match_status === 'IN_PROGRESS'}
                  />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="font-ui text-[13px] text-text-secondary flex items-center gap-2">
                    <Swords className="h-[15px] w-[15px] text-brand-red" />
                    {m.overs_per_innings} overs · {startLabel(m.scheduled_start_time)}
                  </p>
                  <span className="inline-flex items-center gap-1 font-ui text-[13px] font-bold text-brand-red">
                    <ClipboardCheck className="h-[16px] w-[16px]" />
                    Roster
                    <ChevronRight className="h-[16px] w-[16px] transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </motion.button>
            </motion.li>
          ))}
        </ul>
      )}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.match_name ?? 'Match roster'}
        subtitle={open ? `${open.turf_name} · ${startLabel(open.scheduled_start_time)}` : undefined}
        testID="roster-drawer"
      >
        {open &&
          (rosterLoading ? (
            <SkeletonRows rows={4} />
          ) : (
            <>
              {open.scoring_mode === 'TURF_STAFF_MANAGED' &&
                open.match_status !== 'COMPLETED' &&
                open.match_status !== 'CANCELLED' && (
                  <div className="mb-5">
                    <Link href={`/staff/scoring/${open.match_id}`}>
                      <Button icon={Radio} testID="open-scoring">
                        Score this match
                      </Button>
                    </Link>
                  </div>
                )}
              <RosterPanel matchId={open.match_id} players={players} onChange={setPlayers} />
            </>
          ))}
      </Drawer>
    </div>
  );
}
