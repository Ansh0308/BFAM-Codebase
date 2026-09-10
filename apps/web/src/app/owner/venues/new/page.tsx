'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../../lib/apiClient';
import { BFAMApiError } from '../../../../lib/auth';
import { PageHeader, TextInput, PrimaryButton } from '../../../../components/DashboardShell';

// Venues (feedback backlog A-2) — an owner with more than one pitch at the
// same physical location (e.g. "Redline Sports Complex" with Pitch 1/Pitch
// 2) creates one venue here, then adds each pitch under it from Add Turf.
// Each pitch stays its own independently bookable turf; the venue is only
// a shared address/display grouping.
export default function NewVenuePage() {
  const router = useRouter();
  const [venueName, setVenueName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
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
      <PageHeader title="Add Venue" />
      <form onSubmit={submit} className="max-w-md">
        <TextInput label="Venue Name" value={venueName} onChange={setVenueName} />
        <TextInput label="Address" value={addressLine} onChange={setAddressLine} />
        <TextInput label="City" value={city} onChange={setCity} />
        <TextInput label="Latitude" value={latitude} onChange={setLatitude} type="number" />
        <TextInput label="Longitude" value={longitude} onChange={setLongitude} type="number" />
        {error && <p className="text-brand-red font-ui text-body mb-4">{error}</p>}
        <PrimaryButton type="submit" disabled={submitting}>
          Create Venue
        </PrimaryButton>
      </form>
    </div>
  );
}
