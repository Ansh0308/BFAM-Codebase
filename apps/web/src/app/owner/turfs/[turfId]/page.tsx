'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type {
  SetPricingRow,
  Turf,
  TurfAvailabilityBlock,
  TurfPricingRule,
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

const DAY_TYPES = ['WEEKDAY', 'WEEKEND', 'HOLIDAY'] as const;
const BLOCK_REASONS = ['MAINTENANCE', 'HOLIDAY', 'OWNER_BLOCK', 'SYSTEM_BLOCK'] as const;

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

  const [pricing, setPricing] = useState<TurfPricingRule[]>([]);
  const [dayType, setDayType] = useState<(typeof DAY_TYPES)[number]>('WEEKDAY');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('22:00');
  const [pricePerHour, setPricePerHour] = useState('');

  const [blocks, setBlocks] = useState<TurfAvailabilityBlock[]>([]);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState<(typeof BLOCK_REASONS)[number]>('MAINTENANCE');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.getOwnerTurf(turfId),
      apiClient.listAvailabilityBlocks(turfId),
      apiClient.getTurfPricing(turfId),
    ])
      .then(([t, blockRes, pricingRes]) => {
        setTurf(t);
        setTurfName(t.turf_name);
        setAddressLine(t.address_line);
        setCity(t.city);
        setPricing(pricingRes.results);
        setBlocks(blockRes.results);
      })
      .catch(() => setError('Could not load this turf.'))
      .finally(() => setLoading(false));
  }, [turfId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTurf() {
    setError(null);
    try {
      const t = await apiClient.updateTurf(turfId, {
        turf_name: turfName,
        address_line: addressLine,
        city,
      });
      setTurf(t);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save turf details.');
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

  if (loading) return <p className="font-ui text-body text-text-secondary">Loading…</p>;
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
          <TextInput label="Address" value={addressLine} onChange={setAddressLine} />
          <TextInput label="City" value={city} onChange={setCity} />
          <PrimaryButton onClick={saveTurf}>Save Details</PrimaryButton>

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
