'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { CalendarDays, ChevronRight, IndianRupee, MapPin, Plus, Trophy, Users } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type {
  TournamentFormat,
  TournamentInput,
  TournamentListItem,
  TournamentStatus,
} from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { formatRupees } from '../../lib/dates';
import { PageHeader } from '../DashboardShell';
import { Drawer } from '../ui/Drawer';
import { EASE_OUT } from '../ui/motion';
import { useToast } from '../ui/Toast';
import {
  Button,
  EmptyState,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../ui/kit';

type Filter = 'all' | 'open' | 'live' | 'done';

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_KNOCKOUT: 'League + knockout',
};
export const STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: 'Draft',
  REGISTRATION_OPEN: 'Registration open',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
export const STATUS_TONE: Record<TournamentStatus, Tone> = {
  DRAFT: 'neutral',
  REGISTRATION_OPEN: 'info',
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[42px] font-ui text-body text-text-primary transition-all hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

function bucket(s: TournamentStatus): Exclude<Filter, 'all'> {
  if (s === 'DRAFT' || s === 'REGISTRATION_OPEN') return 'open';
  if (s === 'IN_PROGRESS') return 'live';
  return 'done';
}

const day = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

// Tournaments (PRD §9.1 / §9.2): the list shared by Admin and Owner Web.
// `turfs` is given for owners — they must pick one of their turfs to host.
export function TournamentList({
  basePath,
  subtitle,
  turfs,
}: {
  basePath: string;
  subtitle: string;
  turfs?: { turf_id: string; turf_name: string }[];
}) {
  const toast = useToast();
  const [items, setItems] = useState<TournamentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await apiClient.getTournaments()).results);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: items.length,
      open: items.filter((t) => bucket(t.status) === 'open').length,
      live: items.filter((t) => bucket(t.status) === 'live').length,
      done: items.filter((t) => bucket(t.status) === 'done').length,
    }),
    [items],
  );
  const visible = items.filter((t) => filter === 'all' || bucket(t.status) === filter);

  return (
    <div data-testid="tournaments-page">
      <PageHeader
        title="Tournaments"
        subtitle={subtitle}
        action={
          <Button icon={Plus} onClick={() => setCreating(true)} testID="new-tournament">
            New tournament
          </Button>
        }
      />

      <div className="mb-6">
        <SegmentedControl<Filter>
          testIDPrefix="tournament-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'open', label: 'Upcoming', count: counts.open },
            { value: 'live', label: 'Live', count: counts.live },
            { value: 'done', label: 'Finished', count: counts.done },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments"
          message={
            items.length === 0
              ? 'Create your first tournament and invite teams to enter.'
              : 'No tournaments in this view.'
          }
          testID="tournaments-empty"
          action={
            items.length === 0 ? (
              <Button icon={Plus} onClick={() => setCreating(true)}>
                New tournament
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="tournament-list">
          {visible.map((t, index) => (
            <motion.li
              key={t.tournament_id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05, ease: EASE_OUT }}
              whileHover={{ y: -3 }}
            >
              <Link
                href={`${basePath}/${t.tournament_id}`}
                data-testid={`tournament-${t.tournament_id}`}
                className={`group relative block overflow-hidden rounded-lg border bg-surface p-5 transition-shadow duration-300 hover:shadow-[0_16px_36px_rgba(0,0,0,0.1)] ${
                  t.status === 'IN_PROGRESS' ? 'border-brand-red/40' : 'border-border-subtle'
                }`}
              >
                <span
                  aria-hidden
                  className="absolute -right-8 -top-8 h-[110px] w-[110px] rounded-[999px] bg-brand-red/[0.07]"
                />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-ui text-card-title font-bold text-ink-black">
                      {t.name}
                    </p>
                    <p className="mt-1 font-ui text-body text-text-tertiary">
                      {FORMAT_LABEL[t.format]}
                    </p>
                  </div>
                  <StatusPill
                    label={STATUS_LABEL[t.status]}
                    tone={STATUS_TONE[t.status]}
                    pulse={t.status === 'IN_PROGRESS'}
                  />
                </div>
                <div className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-ui text-[13px] text-text-secondary">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-[14px] w-[14px] text-brand-red" />
                    {Number(t.teams)}/{t.max_teams} teams
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <IndianRupee className="h-[14px] w-[14px] text-brand-red" />
                    {Number(t.entry_fee) > 0 ? `${formatRupees(t.entry_fee)} entry` : 'Free entry'}
                  </span>
                  {t.start_date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-[14px] w-[14px] text-brand-red" />
                      {day(t.start_date)}
                    </span>
                  )}
                  {t.turf_name && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-[14px] w-[14px] text-brand-red" />
                      {t.turf_name}
                    </span>
                  )}
                </div>
                <span className="relative mt-4 inline-flex items-center gap-1 font-ui text-[13px] font-bold text-brand-red">
                  Open
                  <ChevronRight className="h-[16px] w-[16px] transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title="New tournament"
        subtitle="You can open registration once it’s created."
        testID="tournament-drawer"
      >
        {creating && (
          <TournamentForm
            turfs={turfs}
            submitLabel="Create tournament"
            onSaved={async (name) => {
              toast.success(`${name} created`);
              setCreating(false);
              await load();
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

export function TournamentForm({
  turfs,
  initial,
  submitLabel,
  onSaved,
  tournamentId,
}: {
  turfs?: { turf_id: string; turf_name: string }[];
  initial?: Partial<TournamentInput>;
  submitLabel: string;
  onSaved: (name: string) => void | Promise<void>;
  tournamentId?: string;
}) {
  const ownerMode = !!turfs;
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [format, setFormat] = useState<TournamentFormat>(initial?.format ?? 'LEAGUE_KNOCKOUT');
  const [turfId, setTurfId] = useState(initial?.turf_id ?? turfs?.[0]?.turf_id ?? '');
  const [overs, setOvers] = useState(String(initial?.overs_per_innings ?? 6));
  const [fee, setFee] = useState(String(initial?.entry_fee ?? 0));
  const [minTeams, setMinTeams] = useState(String(initial?.min_teams ?? 4));
  const [maxTeams, setMaxTeams] = useState(String(initial?.max_teams ?? 8));
  const [doubleRound, setDoubleRound] = useState(Boolean(initial?.double_round));
  const [startDate, setStartDate] = useState(initial?.start_date?.slice(0, 10) ?? '');
  const [deadline, setDeadline] = useState(initial?.registration_deadline?.slice(0, 10) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (name.trim().length < 3) return setError('Give the tournament a name (3+ characters).');
    if (ownerMode && !turfId) return setError('Choose which of your turfs hosts it.');
    const o = Number(overs);
    const lo = Number(minTeams);
    const hi = Number(maxTeams);
    if (!(o >= 1 && o <= 50)) return setError('Overs per innings must be between 1 and 50.');
    if (!(lo >= 2)) return setError('At least 2 teams are needed.');
    if (lo > hi) return setError('The minimum number of teams can’t exceed the maximum.');
    if (startDate && deadline && deadline > startDate) {
      return setError('Registration should close on or before the start date.');
    }
    setError(null);
    setSaving(true);
    const input: TournamentInput = {
      name: name.trim(),
      description: description.trim() || null,
      format,
      ...(ownerMode ? { turf_id: turfId } : {}),
      overs_per_innings: o,
      entry_fee: Number(fee) || 0,
      min_teams: lo,
      max_teams: hi,
      double_round: format !== 'KNOCKOUT' ? doubleRound : false,
      start_date: startDate || null,
      registration_deadline: deadline || null,
    };
    try {
      if (tournamentId) await apiClient.updateTournament(tournamentId, input);
      else await apiClient.createTournament(input);
      await onSaved(input.name);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the tournament.');
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
      data-testid="tournament-form"
    >
      <label className="mb-4 block">
        <span className={LABEL}>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="t-name"
          className={FIELD}
          placeholder="Diwali Cup 2026"
        />
      </label>
      <label className="mb-4 block">
        <span className={LABEL}>About (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          data-testid="t-description"
          className={`${FIELD} h-auto py-2`}
        />
      </label>

      <div className="mb-4">
        <span className={LABEL}>Format</span>
        <div className="mt-1">
          <SegmentedControl<TournamentFormat>
            testIDPrefix="t-format"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'LEAGUE', label: 'League' },
              { value: 'KNOCKOUT', label: 'Knockout' },
              { value: 'LEAGUE_KNOCKOUT', label: 'League + knockout' },
            ]}
          />
        </div>
      </div>

      {ownerMode && (
        <label className="mb-4 block">
          <span className={LABEL}>Hosted at</span>
          <select
            value={turfId}
            onChange={(e) => setTurfId(e.target.value)}
            data-testid="t-turf"
            className={FIELD}
          >
            {turfs!.map((t) => (
              <option key={t.turf_id} value={t.turf_id}>
                {t.turf_name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className={LABEL}>Overs per innings</span>
          <input
            type="number"
            min="1"
            value={overs}
            onChange={(e) => setOvers(e.target.value)}
            data-testid="t-overs"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Entry fee per team (₹)</span>
          <input
            type="number"
            min="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            data-testid="t-fee"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Min teams</span>
          <input
            type="number"
            min="2"
            value={minTeams}
            onChange={(e) => setMinTeams(e.target.value)}
            data-testid="t-min"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Max teams</span>
          <input
            type="number"
            min="2"
            value={maxTeams}
            onChange={(e) => setMaxTeams(e.target.value)}
            data-testid="t-max"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Registration closes</span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            data-testid="t-deadline"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Starts</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            data-testid="t-start"
            className={FIELD}
          />
        </label>
      </div>

      {format !== 'KNOCKOUT' && (
        <label className="mb-5 flex items-center gap-3 font-ui text-body text-ink-black">
          <input
            type="checkbox"
            checked={doubleRound}
            onChange={(e) => setDoubleRound(e.target.checked)}
            data-testid="t-double"
            className="h-[18px] w-[18px] accent-[#D80000]"
          />
          Teams play each other twice (home and away)
        </label>
      )}

      {error && (
        <p
          role="alert"
          data-testid="t-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="t-submit">
        {submitLabel}
      </Button>
    </form>
  );
}
