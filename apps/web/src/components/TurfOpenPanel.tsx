'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { DoorClosed, DoorOpen } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { TurfDayStatus } from '@bfam/shared-types';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Toggle } from './ui/Toggle';
import { useToast } from './ui/Toast';

// Turf open / closed for the day (SW-5): one switch per turf. Closing blocks new
// bookings for today (existing ones stay, and the count is shown so the person
// closing can call those customers). Shared by the staff desk and the owner
// dashboard — each passes its own loader and setter.
export function TurfOpenPanel({
  load,
  setClosed,
}: {
  load: () => Promise<TurfDayStatus[]>;
  setClosed: (turfId: string, closed: boolean) => Promise<TurfDayStatus>;
}) {
  const toast = useToast();
  const [turfs, setTurfs] = useState<TurfDayStatus[] | null>(null);
  const [confirming, setConfirming] = useState<TurfDayStatus | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTurfs(await load());
    } catch {
      setTurfs([]);
    }
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function apply(turf: TurfDayStatus, closed: boolean) {
    setBusyId(turf.turf_id);
    try {
      const next = await setClosed(turf.turf_id, closed);
      setTurfs((list) =>
        (list ?? []).map((t) => (t.turf_id === turf.turf_id ? { ...t, closed: next.closed } : t)),
      );
      toast.success(
        closed ? `${turf.turf_name} is closed for today` : `${turf.turf_name} is open again`,
      );
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not change that turf.');
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  }

  if (!turfs || turfs.length === 0) return null;

  return (
    <section
      className="mb-6 rounded-lg border border-border-subtle bg-surface p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
      data-testid="turf-open-panel"
    >
      <h2 className="mb-3 font-ui text-card-title font-bold text-ink-black">Turf status today</h2>
      <ul className="divide-y divide-border-subtle">
        {turfs.map((t) => (
          <li
            key={t.turf_id}
            className="flex items-center justify-between gap-4 py-3"
            data-testid={`turf-day-${t.turf_id}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid h-[36px] w-[36px] place-items-center rounded-md ${
                  t.closed
                    ? 'bg-status-danger-bg text-status-danger'
                    : 'bg-status-success-bg text-status-success'
                }`}
              >
                {t.closed ? (
                  <DoorClosed className="h-[18px] w-[18px]" />
                ) : (
                  <DoorOpen className="h-[18px] w-[18px]" />
                )}
              </span>
              <div>
                <p className="font-ui text-body font-semibold text-ink-black">{t.turf_name}</p>
                <p
                  className="font-ui text-micro text-text-tertiary"
                  data-testid={`turf-state-${t.turf_id}`}
                >
                  {t.closed ? 'Closed for today' : 'Open'} · {t.bookings_today} booking
                  {t.bookings_today === 1 ? '' : 's'} today
                </p>
              </div>
            </div>
            <Toggle
              checked={!t.closed}
              onChange={(open) => (open ? apply(t, false) : setConfirming(t))}
              disabled={busyId === t.turf_id}
              label={`${t.turf_name} open today`}
              testID={`turf-toggle-${t.turf_id}`}
            />
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirming !== null}
        title="Close for today?"
        message={
          confirming
            ? `${confirming.turf_name} stops taking new bookings for today. ${
                confirming.bookings_today > 0
                  ? `${confirming.bookings_today} existing booking${confirming.bookings_today === 1 ? ' is' : 's are'} not cancelled — contact those customers.`
                  : 'There are no bookings today.'
              }`
            : ''
        }
        confirmLabel="Close turf"
        busy={busyId !== null}
        onConfirm={() => confirming && apply(confirming, true)}
        onCancel={() => setConfirming(null)}
        testID="close-turf-dialog"
      />
    </section>
  );
}
