'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../../lib/apiClient';
import { BFAMApiError } from '../../../../lib/auth';
import { PageHeader, TextInput, PrimaryButton } from '../../../../components/DashboardShell';

// Turf Management (module 2.12, PRD §8.3/§9.2) — add a turf.
export default function NewTurfPage() {
  const router = useRouter();
  const [turfName, setTurfName] = useState('');
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
      !turfName.trim() ||
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
      const turf = await apiClient.createTurf({
        turf_name: turfName.trim(),
        address_line: addressLine.trim(),
        city: city.trim(),
        latitude: lat,
        longitude: lng,
      });
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
        <TextInput label="Address" value={addressLine} onChange={setAddressLine} />
        <TextInput label="City" value={city} onChange={setCity} />
        <TextInput label="Latitude" value={latitude} onChange={setLatitude} type="number" />
        <TextInput label="Longitude" value={longitude} onChange={setLongitude} type="number" />
        {error && <p className="text-brand-red font-ui text-body mb-4">{error}</p>}
        <PrimaryButton type="submit" disabled={submitting}>
          Create Turf
        </PrimaryButton>
      </form>
    </div>
  );
}
