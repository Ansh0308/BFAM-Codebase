'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type {
  SetOperatingHoursRow,
  SetPricingRow,
  Turf,
  TurfAvailabilityBlock,
  TurfOperatingHours,
  TurfPricingRule,
  VenueListItem,
} from '@bfam/shared-types';
import { apiClient } from '../../../../lib/apiClient';
import { BFAMApiError } from '../../../../lib/auth';
import {
  PageHeader,
  TextInput,
  PrimaryButton,
  SecondaryButton,
  Card,
} from '../../../../components/DashboardShell';
import { BallLoader } from '../../../../components/BallLoader';

const DAY_TYPES = ['WEEKDAY', 'WEEKEND', 'HOLIDAY'] as const;
const BLOCK_REASONS = ['MAINTENANCE', 'HOLIDAY', 'OWNER_BLOCK', 'SYSTEM_BLOCK'] as const;
const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Turf Management + Pricing + Availability + Sound Settings (module 2.12,
// PRD §8.3/§9.2) — same combined-hub layout as the mobile equivalent
// (apps/mobile/app/owner-turfs/[turfId].tsx), same apiClient calls.
export default function ManageTurfPage() {
  const { turfId } = useParams<{ turfId: string }>();

  const [turf, setTurf] = useState<Turf | null>(null);
  const [loading, setLoading] = useState(true);
  const [turfName, setTurfName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Venues (backlog A-2) — a pitch linked to a venue has its address
  // auto-filled and locked there; this section is only for a standalone
  // turf that the owner wants to retroactively group.
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [assignVenueId, setAssignVenueId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [pricing, setPricing] = useState<TurfPricingRule[]>([]);
  const [dayType, setDayType] = useState<(typeof DAY_TYPES)[number]>('WEEKDAY');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('22:00');
  const [pricePerHour, setPricePerHour] = useState('');

  // Operating Hours (bookingService requires a row for the requested day —
  // no row means every booking on that day is rejected as
  // OutsideOperatingHoursError, so a turf with none of these set is
  // permanently unbookable). One open/close pair per day of week; a blank
  // pair means "closed that day" and is left out of the saved rows.
  const [hoursByDay, setHoursByDay] = useState<Record<number, { open: string; close: string }>>({});
  const [savingHours, setSavingHours] = useState(false);
  // Backlog A-13: most turfs run the same hours every day — filling in 7
  // rows one at a time to say so was the entire gap. This "default, then
  // override" pair just fills every day at once; the per-day rows below
  // remain individually editable afterward, same as before.
  const [defaultOpen, setDefaultOpen] = useState('06:00');
  const [defaultClose, setDefaultClose] = useState('23:00');

  const [blocks, setBlocks] = useState<TurfAvailabilityBlock[]>([]);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState<(typeof BLOCK_REASONS)[number]>('MAINTENANCE');

  // Backlog A-14: copy another pitch's pricing/hours/description/ball-types/
  // sound-setting onto this one — the owner's other turfs, to pick a source
  // pitch from.
  const [otherTurfs, setOtherTurfs] = useState<Turf[]>([]);
  const [copyFromTurfId, setCopyFromTurfId] = useState<string>('');
  const [copyingDetails, setCopyingDetails] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.getOwnerTurf(turfId),
      apiClient.listAvailabilityBlocks(turfId),
      apiClient.getTurfPricing(turfId),
      apiClient.getTurfOperatingHours(turfId),
      apiClient.getMyTurfs(),
    ])
      .then(([t, blockRes, pricingRes, hoursRes, turfsRes]) => {
        setTurf(t);
        setTurfName(t.turf_name);
        setAddressLine(t.address_line);
        setCity(t.city);
        setPricing(pricingRes.results);
        setBlocks(blockRes.results);
        setOtherTurfs(turfsRes.results.filter((other) => other.turf_id !== turfId));
        const byDay: Record<number, { open: string; close: string }> = {};
        for (const h of hoursRes.results as TurfOperatingHours[]) {
          byDay[h.day_of_week] = { open: h.open_time.slice(0, 5), close: h.close_time.slice(0, 5) };
        }
        setHoursByDay(byDay);
        if (!t.venue_id) {
          apiClient
            .getMyVenues()
            .then((res) => setVenues(res.results))
            .catch(() => setVenues([]));
        }
      })
      .catch(() => setError('Could not load this turf.'))
      .finally(() => setLoading(false));
  }, [turfId]);

  async function copyDetailsFromOtherTurf() {
    if (!copyFromTurfId) return;
    setCopyingDetails(true);
    setError(null);
    try {
      await apiClient.copyTurfDetails(turfId, copyFromTurfId);
      load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not copy pitch details.');
    } finally {
      setCopyingDetails(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function saveTurf() {
    setError(null);
    try {
      // A venue-linked pitch's address is locked to its venue (backlog
      // A-2) — never send address fields for it, or updateTurf 403s.
      const t = await apiClient.updateTurf(
        turfId,
        turf?.venue_id
          ? { turf_name: turfName }
          : { turf_name: turfName, address_line: addressLine, city },
      );
      setTurf(t);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save turf details.');
    }
  }

  async function assignToVenue() {
    if (!assignVenueId) return;
    setAssigning(true);
    setError(null);
    try {
      await apiClient.assignTurfToVenue(turfId, assignVenueId);
      load();
    } catch (err) {
      setError(
        err instanceof BFAMApiError ? err.message : 'Could not assign this turf to a venue.',
      );
    } finally {
      setAssigning(false);
    }
  }

  async function toggleSound() {
    if (!turf) return;
    const next = !turf.stadium_sound_enabled;
    setTurf({ ...turf, stadium_sound_enabled: next });
    try {
      await apiClient.setStadiumSound(turfId, next);
    } catch {
      setTurf({ ...turf, stadium_sound_enabled: !next });
    }
  }

  async function addPricingRow() {
    const price = Number(pricePerHour);
    if (Number.isNaN(price) || price <= 0) {
      setError('Enter a valid price per hour.');
      return;
    }
    setError(null);
    try {
      const rows: SetPricingRow[] = [
        ...pricing.map((p) => ({
          day_type: p.day_type,
          start_time: p.start_time,
          end_time: p.end_time,
          price_per_hour: Number(p.price_per_hour),
        })),
        { day_type: dayType, start_time: startTime, end_time: endTime, price_per_hour: price },
      ];
      const res = await apiClient.setTurfPricing(turfId, rows);
      setPricing(res.results);
      setPricePerHour('');
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save pricing.');
    }
  }

  function setDayHours(day: number, field: 'open' | 'close', value: string) {
    setHoursByDay((prev) => ({
      ...prev,
      [day]: { open: prev[day]?.open ?? '', close: prev[day]?.close ?? '', [field]: value },
    }));
  }

  // Backlog A-13: fills all 7 days with the same open/close time in one
  // click — an owner then tweaks whichever specific day needs to differ
  // using the per-day rows below, instead of typing the same pair of
  // times seven times over.
  function applyDefaultToAllDays() {
    if (!defaultOpen.trim() || !defaultClose.trim()) return;
    const next: Record<number, { open: string; close: string }> = {};
    for (let day = 0; day < 7; day++) {
      next[day] = { open: defaultOpen.trim(), close: defaultClose.trim() };
    }
    setHoursByDay(next);
  }

  async function saveOperatingHours() {
    setSavingHours(true);
    setError(null);
    try {
      const rows: SetOperatingHoursRow[] = Object.entries(hoursByDay)
        .filter(([, v]) => v.open && v.close)
        .map(([day, v]) => ({
          day_of_week: Number(day),
          open_time: v.open,
          close_time: v.close,
        }));
      await apiClient.setTurfOperatingHours(turfId, rows);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save operating hours.');
    } finally {
      setSavingHours(false);
    }
  }

  async function addBlock() {
    if (!blockStart || !blockEnd) {
      setError('Enter a start and end date/time for the block.');
      return;
    }
    setError(null);
    try {
      await apiClient.createAvailabilityBlock(turfId, {
        start_datetime: blockStart,
        end_datetime: blockEnd,
        reason: blockReason,
      });
      setBlockStart('');
      setBlockEnd('');
      const res = await apiClient.listAvailabilityBlocks(turfId);
      setBlocks(res.results);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the block.');
    }
  }

  async function removeBlock(blockId: string) {
    await apiClient.removeAvailabilityBlock(blockId);
    setBlocks((prev) => prev.filter((b) => b.block_id !== blockId));
  }

  if (loading) return <BallLoader />;
  if (!turf)
    return <p className="font-ui text-body text-text-secondary">Could not load this turf.</p>;

  return (
    <div data-testid="manage-turf-page">
      <PageHeader title={turf.turf_name} />
      {error && <p className="text-brand-red font-ui text-body mb-4">{error}</p>}

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h2 className="font-ui font-bold text-body text-text-secondary uppercase text-micro mb-4">
            Turf Details
          </h2>
          <TextInput label="Turf Name" value={turfName} onChange={setTurfName} />
          {turf.venue_id ? (
            <>
              <p
                className="font-ui text-micro text-text-tertiary mb-2"
                data-testid="turf-venue-note"
              >
                {turf.venue_name} · address is managed by this venue.
              </p>
              <TextInput label="Address" value={addressLine} onChange={() => {}} disabled />
              <TextInput label="City" value={city} onChange={() => {}} disabled />
            </>
          ) : (
            <>
              <TextInput label="Address" value={addressLine} onChange={setAddressLine} />
              <TextInput label="City" value={city} onChange={setCity} />
            </>
          )}
          <PrimaryButton onClick={saveTurf}>Save Details</PrimaryButton>

          {!turf.venue_id && venues.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border-subtle">
              <h3 className="font-ui font-bold text-body text-text-secondary uppercase text-micro mb-2">
                Group into a Venue
              </h3>
              <p className="font-ui text-micro text-text-tertiary mb-3">
                Already have another pitch at this same location? Group this turf under an existing
                venue — its address will switch to the venue&apos;s.
              </p>
              <div className="flex flex-wrap gap-2 mb-3" data-testid="assign-venue-select">
                {venues.map((v) => (
                  <button
                    key={v.venue_id}
                    type="button"
                    onClick={() => setAssignVenueId(v.venue_id)}
                    data-testid={`assign-venue-${v.venue_id}`}
                    className={`rounded-md border px-4 py-2 font-ui text-body ${
                      assignVenueId === v.venue_id
                        ? 'bg-brand-red border-brand-red text-white font-bold'
                        : 'bg-surface border-border-strong text-text-primary'
                    }`}
                  >
                    {v.venue_name}
                  </button>
                ))}
              </div>
              <PrimaryButton onClick={assignToVenue} disabled={!assignVenueId || assigning}>
                {assigning ? 'Assigning…' : 'Assign to Venue'}
              </PrimaryButton>
            </div>
          )}

          {/* Backlog A-14: adding another pitch at the same venue
              shouldn't mean re-entering identical pricing/hours by hand. */}
          {otherTurfs.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border-subtle">
              <h3 className="font-ui font-bold text-body text-text-secondary uppercase text-micro mb-2">
                Copy Details From Another Pitch
              </h3>
              <p className="font-ui text-micro text-text-tertiary mb-3">
                Copies pricing, operating hours, description, ball types, and the sound setting from
                the pitch you pick — replacing whatever this pitch already has.
              </p>
              <div className="flex flex-wrap gap-2 mb-3" data-testid="copy-from-turf-select">
                {otherTurfs.map((t) => (
                  <button
                    key={t.turf_id}
                    type="button"
                    onClick={() => setCopyFromTurfId(t.turf_id)}
                    data-testid={`copy-from-turf-${t.turf_id}`}
                    className={`rounded-md border px-4 py-2 font-ui text-body ${
                      copyFromTurfId === t.turf_id
                        ? 'bg-brand-red border-brand-red text-white font-bold'
                        : 'bg-surface border-border-strong text-text-primary'
                    }`}
                  >
                    {t.turf_name}
                  </button>
                ))}
              </div>
              <PrimaryButton
                onClick={copyDetailsFromOtherTurf}
                disabled={!copyFromTurfId || copyingDetails}
              >
                {copyingDetails ? 'Copying…' : 'Copy Details'}
              </PrimaryButton>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-border-subtle">
            <span className="font-ui text-body text-text-primary">Stadium Sound</span>
            <button
              onClick={toggleSound}
              data-testid="toggle-stadium-sound"
              className={`rounded-full w-11 h-6 px-0.5 flex items-center ${
                turf.stadium_sound_enabled
                  ? 'bg-brand-red justify-end'
                  : 'bg-border-strong justify-start'
              }`}
            >
              <span className="bg-white w-5 h-5 rounded-full block" />
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="font-ui font-bold text-body text-text-secondary uppercase text-micro mb-4">
            Pricing
          </h2>
          {pricing.map((p, i) => (
            <p
              key={i}
              className="font-ui text-body text-text-primary mb-2"
              data-testid={`pricing-row-${i}`}
            >
              {p.day_type} · {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)} · ₹
              {p.price_per_hour}/hr
            </p>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <label className="block mb-4">
              <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
                Day Type
              </span>
              <select
                value={dayType}
                onChange={(e) => setDayType(e.target.value as (typeof DAY_TYPES)[number])}
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 font-ui text-body"
              >
                {DAY_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <TextInput
              label="Price/Hour"
              value={pricePerHour}
              onChange={setPricePerHour}
              type="number"
            />
            <TextInput label="Start Time" value={startTime} onChange={setStartTime} />
            <TextInput label="End Time" value={endTime} onChange={setEndTime} />
          </div>
          <SecondaryButton onClick={addPricingRow}>Add Pricing Row</SecondaryButton>
        </Card>
      </div>

      <Card className="mt-6" data-testid="operating-hours-card">
        <h2 className="font-ui font-bold text-body text-text-secondary uppercase text-micro mb-4">
          Operating Hours
        </h2>
        <p className="font-ui text-micro text-text-tertiary mb-4">
          Leave a day blank to mark it closed. A day with no hours set can never be booked.
        </p>

        <h3 className="font-ui font-bold text-micro text-text-tertiary uppercase mb-2">
          Apply a Default to Every Day
        </h3>
        <div className="grid grid-cols-3 gap-2 items-end mb-4">
          <TextInput
            label="Open"
            value={defaultOpen}
            onChange={setDefaultOpen}
            placeholder="06:00"
          />
          <TextInput
            label="Close"
            value={defaultClose}
            onChange={setDefaultClose}
            placeholder="23:00"
          />
          <SecondaryButton onClick={applyDefaultToAllDays}>Apply to All Days</SecondaryButton>
        </div>

        {WEEKDAY_LABELS.map((label, day) => (
          <div key={day} className="grid grid-cols-3 gap-2 items-end mb-2">
            <span className="font-ui text-body text-text-primary pb-2">{label}</span>
            <TextInput
              label="Open"
              value={hoursByDay[day]?.open ?? ''}
              onChange={(v) => setDayHours(day, 'open', v)}
              placeholder="06:00"
            />
            <TextInput
              label="Close"
              value={hoursByDay[day]?.close ?? ''}
              onChange={(v) => setDayHours(day, 'close', v)}
              placeholder="23:00"
            />
          </div>
        ))}
        <PrimaryButton onClick={saveOperatingHours} disabled={savingHours}>
          {savingHours ? 'Saving…' : 'Save Operating Hours'}
        </PrimaryButton>
      </Card>

      <Card className="mt-6">
        <h2 className="font-ui font-bold text-body text-text-secondary uppercase text-micro mb-4">
          Availability Blocks
        </h2>
        {blocks.map((b) => (
          <div
            key={b.block_id}
            className="flex items-center justify-between py-2 border-b border-border-subtle"
            data-testid={`block-row-${b.block_id}`}
          >
            <span className="font-ui text-body text-text-primary">
              {b.reason} · {new Date(b.start_datetime).toLocaleString()} –{' '}
              {new Date(b.end_datetime).toLocaleString()}
            </span>
            <SecondaryButton onClick={() => removeBlock(b.block_id)}>Remove</SecondaryButton>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <TextInput
            label="Start"
            value={blockStart}
            onChange={setBlockStart}
            type="datetime-local"
          />
          <TextInput label="End" value={blockEnd} onChange={setBlockEnd} type="datetime-local" />
          <label className="block mb-4">
            <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
              Reason
            </span>
            <select
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value as (typeof BLOCK_REASONS)[number])}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 font-ui text-body"
            >
              {BLOCK_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <SecondaryButton onClick={addBlock}>Add Block</SecondaryButton>
      </Card>
    </div>
  );
}
