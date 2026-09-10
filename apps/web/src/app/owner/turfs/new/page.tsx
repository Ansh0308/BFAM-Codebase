'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { VenueListItem } from '@bfam/shared-types';
import { apiClient } from '../../../../lib/apiClient';
import { BFAMApiError } from '../../../../lib/auth';
import { PageHeader, TextInput, PrimaryButton } from '../../../../components/DashboardShell';

const STANDALONE = 'STANDALONE';

// Turf Management (module 2.12, PRD §8.3/§9.2) — add a turf. Backlog A-2:
// an owner with more than one pitch at the same physical location can add
// this pitch under an existing venue instead of giving it its own address —
// the venue's address is then auto-filled and stays locked to it.
export default function NewTurfPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetVenueId = searchParams.get('venueId');

  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [venueChoice, setVenueChoice] = useState<string>(presetVenueId || STANDALONE);

  const [turfName, setTurfName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .getMyVenues()
      .then((res) => setVenues(res.results))
      .catch(() => setVenues([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!turfName.trim()) {
      setError('Enter a turf name.');
      return;
    }

    const usingVenue = venueChoice !== STANDALONE;
    let lat = 0;
    let lng = 0;
    if (!usingVenue) {
      lat = Number(latitude);
      lng = Number(longitude);
      if (!addressLine.trim() || !city.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
        setError('Fill in every field with a valid latitude/longitude.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const turf = await apiClient.createTurf(
        usingVenue
          ? { turf_name: turfName.trim(), venue_id: venueChoice }
          : {
              turf_name: turfName.trim(),
              address_line: addressLine.trim(),
              city: city.trim(),
              latitude: lat,
              longitude: lng,
            },
      );
      router.replace(`/owner/turfs/${turf.turf_id}`);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the turf.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-testid="new-turf-page">
      <PageHeader title="Add Turf" />
      <form onSubmit={submit} className="max-w-md">
        <TextInput label="Turf Name" value={turfName} onChange={setTurfName} />

        <label className="block mb-2">
          <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
            Venue
          </span>
        </label>
        <div className="flex flex-wrap gap-2 mb-2" data-testid="turf-venue-select">
          <button
            type="button"
            onClick={() => setVenueChoice(STANDALONE)}
            data-testid="turf-venue-STANDALONE"
            className={`rounded-md border px-4 py-2 font-ui text-body ${
              venueChoice === STANDALONE
                ? 'bg-brand-red border-brand-red text-white font-bold'
                : 'bg-surface border-border-strong text-text-primary'
            }`}
          >
            Standalone
          </button>
          {venues.map((v) => (
            <button
              key={v.venue_id}
              type="button"
              onClick={() => setVenueChoice(v.venue_id)}
              data-testid={`turf-venue-${v.venue_id}`}
              className={`rounded-md border px-4 py-2 font-ui text-body ${
                venueChoice === v.venue_id
                  ? 'bg-brand-red border-brand-red text-white font-bold'
                  : 'bg-surface border-border-strong text-text-primary'
              }`}
            >
              {v.venue_name}
            </button>
          ))}
        </div>
        <Link
          href="/owner/venues/new"
          className="block font-ui text-micro text-brand-red mb-4"
          data-testid="new-venue-link"
        >
          Don&apos;t see the venue you want? + Create a new venue
        </Link>

        {venueChoice === STANDALONE ? (
          <>
            <TextInput label="Address" value={addressLine} onChange={setAddressLine} />
            <TextInput label="City" value={city} onChange={setCity} />
            <TextInput label="Latitude" value={latitude} onChange={setLatitude} type="number" />
            <TextInput label="Longitude" value={longitude} onChange={setLongitude} type="number" />
          </>
        ) : (
          <p
            className="font-ui text-body text-text-tertiary mb-4"
            data-testid="turf-venue-address-note"
          >
            This pitch will use the venue&apos;s address.
          </p>
        )}

        {error && <p className="text-brand-red font-ui text-body mb-4">{error}</p>}
        <PrimaryButton type="submit" disabled={submitting}>
          Create Turf
        </PrimaryButton>
      </form>
    </div>
  );
}
