'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { VenueDetails } from '@bfam/shared-types';
import { apiClient } from '../../../../lib/apiClient';
import { BFAMApiError } from '../../../../lib/auth';
import { PageHeader, TextInput, PrimaryButton, Card } from '../../../../components/DashboardShell';

// Venue detail (feedback backlog A-2) — lists every pitch grouped under
// this venue ("Redline Sports Complex — Pitch 1 / Pitch 2") and lets the
// owner edit the shared venue address, which cascades to every pitch here.
export default function ManageVenuePage() {
  const { venueId } = useParams<{ venueId: string }>();

  const [venue, setVenue] = useState<VenueDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [venueName, setVenueName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getVenue(venueId)
      .then((v) => {
        setVenue(v);
        setVenueName(v.venue_name);
        setAddressLine(v.address_line);
        setCity(v.city);
      })
      .catch(() => setError('Could not load this venue.'))
      .finally(() => setLoading(false));
  }, [venueId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setError(null);
    try {
      await apiClient.updateVenue(venueId, {
        venue_name: venueName,
        address_line: addressLine,
        city,
      });
      load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save venue details.');
    }
  }

  if (loading) return <p className="font-ui text-body text-text-secondary">Loading…</p>;
  if (!venue)
    return <p className="font-ui text-body text-text-secondary">Could not load this venue.</p>;

  return (
    <div data-testid="manage-venue-page">
      <PageHeader title={venue.venue_name} />
      {error && <p className="text-brand-red font-ui text-body mb-4">{error}</p>}

      <Card className="max-w-md">
        <h2 className="font-ui font-bold text-body text-text-secondary uppercase text-micro mb-2">
          Venue Details
        </h2>
        <p className="font-ui text-micro text-text-tertiary mb-4">
          Editing the address here updates every pitch at this venue.
        </p>
        <TextInput label="Venue Name" value={venueName} onChange={setVenueName} />
        <TextInput label="Address" value={addressLine} onChange={setAddressLine} />
        <TextInput label="City" value={city} onChange={setCity} />
        <PrimaryButton onClick={save}>Save Details</PrimaryButton>
      </Card>

      <div className="flex items-center justify-between mt-6 mb-4">
        <h2 className="font-ui font-bold text-body text-text-secondary uppercase text-micro">
          Pitches ({venue.turfs.length})
        </h2>
        <Link
          href={`/owner/turfs/new?venueId=${venue.venue_id}`}
          className="font-ui font-bold text-body text-brand-red"
          data-testid="add-pitch-button"
        >
          + Add Pitch
        </Link>
      </div>

      {venue.turfs.length === 0 ? (
        <p className="font-ui text-body text-text-tertiary" data-testid="venue-pitches-empty">
          No pitches yet — add the first one at this venue.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {venue.turfs.map((t) => (
            <Link key={t.turf_id} href={`/owner/turfs/${t.turf_id}`}>
              <Card
                className="hover:ring-1 hover:ring-brand-red cursor-pointer"
                data-testid={`venue-pitch-card-${t.turf_id}`}
              >
                <p className="font-ui font-bold text-body text-text-primary">{t.turf_name}</p>
                <p className="font-ui text-micro text-text-tertiary mt-1">{t.turf_status}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
