'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../../lib/apiClient';
import { BFAMApiError } from '../../../../lib/auth';
import { PageHeader, TextInput, PrimaryButton } from '../../../../components/DashboardShell';

const MIN_PITCHES = 1;
const MAX_PITCHES = 20;

// Add Venue (feedback backlog A-2, simplified per follow-up feedback): one
// form for an owner's turf/venue details plus how many pitches they have
// there — venue and every pitch under it are created together in a single
// step, instead of creating the venue and then each pitch separately. Each
// pitch is still its own fully independent, bookable turf (auto-named
// "Pitch 1"/"Pitch 2"/... — rename any of them from its own management
// page after creation).
export default function NewVenuePage() {
  const router = useRouter();
  const [venueName, setVenueName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [pitchCount, setPitchCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      !venueName.trim() ||
      !addressLine.trim() ||
      !city.trim() ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      setError('Fill in every field with a valid latitude/longitude.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const venue = await apiClient.createVenue({
        venue_name: venueName.trim(),
        address_line: addressLine.trim(),
        city: city.trim(),
        latitude: lat,
        longitude: lng,
        pitch_count: pitchCount,
      });
      router.replace(`/owner/venues/${venue.venue_id}`);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the venue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-testid="new-venue-page">
      <PageHeader title="Add Turf" />
      <form onSubmit={submit} className="max-w-md">
        <p className="font-ui text-body text-text-tertiary mb-4">
          Enter your turf&apos;s details, then tell us how many pitches you have there — we&apos;ll
          set them all up at once.
        </p>
        <TextInput label="Turf / Venue Name" value={venueName} onChange={setVenueName} />
        <TextInput label="Address" value={addressLine} onChange={setAddressLine} />
        <TextInput label="City" value={city} onChange={setCity} />
        <TextInput label="Latitude" value={latitude} onChange={setLatitude} type="number" />
        <TextInput label="Longitude" value={longitude} onChange={setLongitude} type="number" />

        <label className="block mb-2">
          <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
            How Many Pitches / Turfs?
          </span>
        </label>
        <div className="flex items-center gap-4 mb-2">
          <button
            type="button"
            onClick={() => setPitchCount((n) => Math.max(MIN_PITCHES, n - 1))}
            data-testid="pitch-count-decrease"
            className="w-11 h-11 rounded-md bg-surface-alt font-ui text-title-md text-text-primary"
          >
            −
          </button>
          <span
            className="font-ui font-bold text-title-md text-text-primary"
            data-testid="pitch-count-value"
          >
            {pitchCount}
          </span>
          <button
            type="button"
            onClick={() => setPitchCount((n) => Math.min(MAX_PITCHES, n + 1))}
            data-testid="pitch-count-increase"
            className="w-11 h-11 rounded-md bg-surface-alt font-ui text-title-md text-text-primary"
          >
            +
          </button>
        </div>
        <p className="font-ui text-micro text-text-tertiary mb-4">
          {pitchCount === 1
            ? 'We’ll create 1 pitch for you to set up.'
            : `We’ll create ${pitchCount} pitches ("Pitch 1"–"Pitch ${pitchCount}") for you to set up — each is booked separately.`}
        </p>

        {error && <p className="text-brand-red font-ui text-body mb-4">{error}</p>}
        <PrimaryButton type="submit" disabled={submitting}>
          Create Turf
        </PrimaryButton>
      </form>
    </div>
  );
}
