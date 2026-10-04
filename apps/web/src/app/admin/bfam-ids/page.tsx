'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Hash, Lock, LockOpen, RefreshCw, UserCheck } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { AdminPlayer, ReservedBfamId } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { timeAgo } from '../../../lib/dates';
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
  StatTile,
  StatusPill,
} from '../../../components/ui/kit';

type Filter = 'all' | 'LOCKED' | 'ASSIGNED';

// BFAM ID reservations (PRD §12.59): lock a premium or jersey-number ID (BF7,
// BF18…) so the normal sequential allocator never hands it out, then assign
// it to a specific player — or release it again.
export default function AdminBfamIdsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ReservedBfamId[]>([]);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [newId, setNewId] = useState('');
  const [notes, setNotes] = useState('');
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<ReservedBfamId | null>(null);
  const [unlocking, setUnlocking] = useState<ReservedBfamId | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [r, p] = await Promise.allSettled([
      apiClient.getReservedBfamIds(),
      apiClient.getAllPlayers(),
    ]);
    setRows(r.status === 'fulfilled' ? r.value : []);
    setPlayers(p.status === 'fulfilled' ? p.value.results : []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const locked = rows.filter((r) => r.status === 'LOCKED').length;
  const assigned = rows.filter((r) => r.status === 'ASSIGNED').length;
  const visible = rows.filter((r) => filter === 'all' || r.status === filter);
  const playerById = useMemo(() => new Map(players.map((p) => [p.user_id, p])), [players]);

  async function lock() {
    const id = newId.trim().toUpperCase();
    if (!/^BF\d+$/.test(id)) {
      setLockError('Use the format BF followed by digits, e.g. BF7.');
      return;
    }
    setLockError(null);
    setLocking(true);
    try {
      await apiClient.lockBfamId(id, notes.trim() || undefined);
      toast.success(`${id} is reserved`);
      setNewId('');
      setNotes('');
      await load(true);
    } catch (err) {
      setLockError(err instanceof BFAMApiError ? err.message : 'Could not reserve that ID.');
    } finally {
      setLocking(false);
    }
  }

  async function unlock(r: ReservedBfamId) {
    setBusy(true);
    try {
      await apiClient.unlockBfamId(r.bfam_id);
      toast.success(`${r.bfam_id} released back to the pool`);
      setUnlocking(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not release that ID.');
    } finally {
      setBusy(false);
    }
  }

  async function assign(r: ReservedBfamId, player: AdminPlayer) {
    setBusy(true);
    try {
      await apiClient.assignBfamId(r.bfam_id, player.user_id);
      toast.success(`${r.bfam_id} assigned to ${player.full_name || player.phone_number}`);
      setAssigning(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not assign that ID.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="admin-bfam-ids-page">
      <PageHeader
        title="BFAM IDs"
        subtitle="Reserve memorable IDs and give them to specific players."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => load(true)}
            testID="ids-refresh"
          >
            Refresh
          </Button>
        }
      />

      <div className="mb-7 grid grid-cols-2 gap-4 xl:grid-cols-3">
        <StatTile
          label="Reserved"
          value={locked}
          icon={Lock}
          tone="brand"
          delay={0.05}
          hint="Held, not yet given out"
        />
        <StatTile
          label="Assigned"
          value={assigned}
          icon={UserCheck}
          delay={0.1}
          hint="Given to a player"
        />
        <StatTile
          label="Total"
          value={rows.length}
          icon={Hash}
          delay={0.15}
          hint="Reservations made"
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lock();
        }}
        className="mb-7 rounded-lg border border-border-subtle bg-surface p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
        data-testid="lock-form"
      >
        <h2 className="mb-3 font-ui text-micro uppercase tracking-[0.16em] text-text-secondary">
          Reserve an ID
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
              BFAM ID
            </span>
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value.toUpperCase())}
              placeholder="BF18"
              data-testid="lock-id"
              className="mt-1 block h-[46px] w-[160px] rounded-md border border-border-strong bg-surface px-3 font-display text-[22px] tracking-widest focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]"
            />
          </label>
          <label className="block min-w-[240px] flex-1">
            <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
              Note (optional)
            </span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Jersey number for the captain"
              data-testid="lock-notes"
              maxLength={255}
              className="mt-1 block h-[46px] w-full rounded-md border border-border-strong bg-surface px-3 font-ui text-body focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]"
            />
          </label>
          <Button type="submit" size="lg" icon={Lock} loading={locking} testID="lock-submit">
            Reserve
          </Button>
        </div>
        {lockError && (
          <p
            role="alert"
            data-testid="lock-error"
            className="mt-3 font-ui text-body text-status-danger"
          >
            {lockError}
          </p>
        )}
      </form>

      <div className="mb-5">
        <SegmentedControl<Filter>
          testIDPrefix="ids-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: rows.length },
            { value: 'LOCKED', label: 'Reserved', count: locked },
            { value: 'ASSIGNED', label: 'Assigned', count: assigned },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="No reservations"
          message={
            rows.length === 0
              ? 'Reserve a BFAM ID above to hold it back from normal sign-ups.'
              : 'Nothing in this view.'
          }
          testID="ids-empty"
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="ids-list">
          {visible.map((r, index) => {
            const owner = r.assigned_to_user_id ? playerById.get(r.assigned_to_user_id) : undefined;
            return (
              <motion.li
                key={r.reservation_id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05, ease: EASE_OUT }}
                whileHover={{ y: -3 }}
                data-testid={`id-${r.bfam_id}`}
                className="flex items-center gap-5 rounded-lg border border-border-subtle bg-surface p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-shadow duration-300 hover:shadow-[0_14px_34px_rgba(0,0,0,0.09)]"
              >
                <p className="w-[110px] shrink-0 font-display text-[40px] leading-none tracking-wider text-ink-black">
                  {r.bfam_id}
                </p>
                <div className="min-w-0 flex-1">
                  <StatusPill
                    tone={r.status === 'LOCKED' ? 'warning' : 'success'}
                    label={r.status === 'LOCKED' ? 'Reserved' : 'Assigned'}
                  />
                  {r.notes && (
                    <p className="mt-2 truncate font-ui text-body text-text-secondary">{r.notes}</p>
                  )}
                  <p className="mt-1 font-ui text-[12px] text-text-tertiary">
                    {r.status === 'ASSIGNED'
                      ? `To ${owner?.full_name || owner?.phone_number || 'a player'} · ${r.assigned_at ? timeAgo(r.assigned_at) : ''}`
                      : `Reserved ${timeAgo(r.locked_at)}`}
                  </p>
                </div>
                {r.status === 'LOCKED' && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      icon={UserCheck}
                      onClick={() => setAssigning(r)}
                      testID={`assign-${r.bfam_id}`}
                    >
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={LockOpen}
                      onClick={() => setUnlocking(r)}
                      testID={`unlock-${r.bfam_id}`}
                    >
                      Release
                    </Button>
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}

      <Drawer
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        title={assigning ? `Assign ${assigning.bfam_id}` : 'Assign'}
        subtitle="Pick the player who should get this ID."
        testID="assign-drawer"
      >
        {assigning && (
          <PlayerPicker players={players} busy={busy} onPick={(p) => assign(assigning, p)} />
        )}
      </Drawer>

      <ConfirmDialog
        open={unlocking !== null}
        title="Release this ID?"
        message={`${unlocking?.bfam_id ?? ''} goes back to the normal pool, so new sign-ups can receive it.`}
        confirmLabel="Release"
        cancelLabel="Keep reserved"
        busy={busy}
        onCancel={() => setUnlocking(null)}
        onConfirm={() => unlocking && unlock(unlocking)}
        testID="unlock-dialog"
      />
    </div>
  );
}

function PlayerPicker({
  players,
  busy,
  onPick,
}: {
  players: AdminPlayer[];
  busy: boolean;
  onPick: (p: AdminPlayer) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? players.filter((p) =>
          [p.full_name, p.phone_number, p.bfam_id, p.email]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : players;
    return list.slice(0, 30);
  }, [players, query]);

  return (
    <div data-testid="player-picker">
      <div className="mb-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search name, phone or BFAM ID"
          ariaLabel="Search players"
          testID="player-search"
        />
      </div>
      {matches.length === 0 ? (
        <p className="font-ui text-body text-text-tertiary">No players match.</p>
      ) : (
        <ul className="space-y-2">
          {matches.map((p) => (
            <li key={p.user_id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(p)}
                data-testid={`pick-${p.user_id}`}
                className="flex w-full items-center justify-between rounded-lg border border-border-subtle px-4 py-3 text-left cursor-pointer transition-colors hover:border-brand-red hover:bg-brand-red/[0.04] disabled:cursor-wait disabled:opacity-60"
              >
                <span>
                  <span className="block font-ui text-body font-semibold text-ink-black">
                    {p.full_name || 'Player'}
                  </span>
                  <span className="block font-ui text-[12px] text-text-tertiary">
                    {p.phone_number}
                  </span>
                </span>
                <span className="font-display text-[20px] tracking-wider text-text-secondary">
                  {p.bfam_id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
