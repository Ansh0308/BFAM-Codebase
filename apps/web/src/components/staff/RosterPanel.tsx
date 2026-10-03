'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCheck, CheckCircle2, Clock3, UserX } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { MatchAttendanceStatus, MatchPlayer } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { Avatar, Button, StatusPill, type Tone } from '../ui/kit';
import { useToast } from '../ui/Toast';
import { EASE_OUT } from '../ui/motion';

const STATUS_LABEL: Record<MatchAttendanceStatus, string> = {
  PENDING: 'Awaiting',
  RUNNING_LATE: 'Running late',
  CHECKED_IN: 'Checked in',
  NO_SHOW: 'No-show',
};
const STATUS_TONE: Record<MatchAttendanceStatus, Tone> = {
  PENDING: 'neutral',
  RUNNING_LATE: 'warning',
  CHECKED_IN: 'success',
  NO_SHOW: 'danger',
};

export function playerLabel(p: Pick<MatchPlayer, 'full_name' | 'bfam_id'>): string {
  return p.full_name?.trim() || p.bfam_id || 'Player';
}

// The desk-side roster: who has arrived, who is late, who isn't coming.
// Every change goes through the same POST /matches/:id/attendance/:playerId
// the mobile app uses (which also enforces staff verification server-side),
// applied optimistically and rolled back with the server's reason if refused.
export function RosterPanel({
  matchId,
  players,
  onChange,
  canAct = true,
}: {
  matchId: string;
  players: MatchPlayer[];
  onChange: (players: MatchPlayer[]) => void;
  canAct?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c = { CHECKED_IN: 0, RUNNING_LATE: 0, NO_SHOW: 0, PENDING: 0 };
    for (const p of players) c[p.attendance_status] += 1;
    return c;
  }, [players]);

  const total = players.length;
  const arrivedPct = total === 0 ? 0 : Math.round((counts.CHECKED_IN / total) * 100);

  async function setStatus(player: MatchPlayer, status: MatchAttendanceStatus): Promise<boolean> {
    if (player.attendance_status === status) return true;
    const previous = players;
    onChange(
      players.map((p) =>
        p.player_id === player.player_id ? { ...p, attendance_status: status } : p,
      ),
    );
    setBusy((s) => new Set(s).add(player.player_id));
    try {
      await apiClient.setPlayerAttendance(matchId, player.player_id, status);
      return true;
    } catch (err) {
      onChange(previous);
      toast.error(
        err instanceof BFAMApiError ? err.message : 'Could not update attendance. Try again.',
      );
      return false;
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(player.player_id);
        return next;
      });
    }
  }

  async function checkInAllPending() {
    const pending = players.filter((p) => p.attendance_status === 'PENDING');
    let done = 0;
    for (const p of pending) {
      // Sequential on purpose: keeps the optimistic list consistent and
      // stops at the first refusal (e.g. unverified staff) instead of
      // firing a burst of identical errors.
      const ok = await setStatus(p, 'CHECKED_IN');
      if (!ok) break;
      done += 1;
    }
    if (done > 0) toast.success(`${done} player${done === 1 ? '' : 's'} checked in`);
  }

  if (total === 0) {
    return (
      <p className="font-ui text-body text-text-tertiary" data-testid="roster-empty">
        No players on this match&apos;s roster yet.
      </p>
    );
  }

  return (
    <div data-testid="roster-panel">
      <div className="rounded-lg border border-border-subtle bg-surface-alt p-4 mb-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="font-ui text-micro uppercase tracking-wider text-text-tertiary">
              Arrived
            </p>
            <p className="font-display text-[34px] leading-none text-ink-black">
              {counts.CHECKED_IN}
              <span className="text-text-tertiary"> / {total}</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <StatusPill tone="warning" label={`${counts.RUNNING_LATE} late`} />
            <StatusPill tone="danger" label={`${counts.NO_SHOW} no-show`} />
            <StatusPill tone="neutral" label={`${counts.PENDING} awaiting`} />
          </div>
        </div>
        <div
          className="h-[8px] rounded-[999px] bg-ink-black/[0.08] overflow-hidden"
          role="progressbar"
          aria-valuenow={arrivedPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Players arrived"
        >
          <motion.div
            className="h-full rounded-[999px] bg-brand-red"
            initial={{ width: 0 }}
            animate={{ width: `${arrivedPct}%` }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          />
        </div>
        {canAct && counts.PENDING > 0 && (
          <div className="mt-4">
            <Button
              size="sm"
              variant="secondary"
              icon={CheckCheck}
              onClick={checkInAllPending}
              testID="check-in-all"
            >
              Check in all awaiting ({counts.PENDING})
            </Button>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {players.map((p, index) => {
            const isBusy = busy.has(p.player_id);
            return (
              <motion.li
                key={p.player_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.03, ease: EASE_OUT }}
                className={`flex items-center gap-3 rounded-lg border bg-surface px-3 py-[10px] transition-colors duration-300 ${
                  p.attendance_status === 'CHECKED_IN'
                    ? 'border-brand-red/30 bg-brand-red/[0.03]'
                    : 'border-border-subtle'
                }`}
                data-testid={`roster-row-${p.player_id}`}
              >
                <Avatar name={playerLabel(p)} />
                <div className="min-w-0 flex-1">
                  <p className="font-ui text-body font-semibold text-ink-black truncate">
                    {playerLabel(p)}
                  </p>
                  <p className="font-ui text-[12px] text-text-tertiary truncate">
                    {p.bfam_id}
                    {p.side_label ? ` · ${p.side_label}` : ''}
                    {p.participant_role !== 'PLAYER'
                      ? ` · ${p.participant_role.toLowerCase()}`
                      : ''}
                  </p>
                </div>
                <StatusPill
                  tone={STATUS_TONE[p.attendance_status]}
                  label={STATUS_LABEL[p.attendance_status]}
                />
                {canAct && (
                  <div className="flex items-center gap-1">
                    <IconAction
                      label={`Check in ${playerLabel(p)}`}
                      testID={`checkin-${p.player_id}`}
                      active={p.attendance_status === 'CHECKED_IN'}
                      disabled={isBusy}
                      onClick={() => setStatus(p, 'CHECKED_IN')}
                      icon={CheckCircle2}
                    />
                    <IconAction
                      label={`Mark ${playerLabel(p)} running late`}
                      testID={`late-${p.player_id}`}
                      active={p.attendance_status === 'RUNNING_LATE'}
                      disabled={isBusy}
                      onClick={() => setStatus(p, 'RUNNING_LATE')}
                      icon={Clock3}
                    />
                    <IconAction
                      label={`Mark ${playerLabel(p)} no-show`}
                      testID={`noshow-${p.player_id}`}
                      active={p.attendance_status === 'NO_SHOW'}
                      disabled={isBusy}
                      onClick={() => setStatus(p, 'NO_SHOW')}
                      icon={UserX}
                    />
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function IconAction({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
  testID,
}: {
  label: string;
  icon: typeof CheckCircle2;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  testID: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      data-testid={testID}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      whileHover={{ y: -1 }}
      className={`grid h-[36px] w-[36px] place-items-center rounded-md border transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
        active
          ? 'border-brand-red bg-brand-red text-white shadow-[0_4px_12px_rgba(216,0,0,0.3)]'
          : 'border-border-strong text-text-secondary hover:border-brand-red hover:text-brand-red'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </motion.button>
  );
}
