'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Turf } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { PageHeader, Card, PrimaryButton } from '../../components/DashboardShell';

// Owner Dashboard (module 2.12, PRD §8.3/§9.2) — business overview: every
// turf this owner runs.
export default function OwnerDashboardPage() {
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => setTurfs(res.results))
      .catch(() => setTurfs([]))
      .finally(() => setLoading(false));
  }, []);

  // Venues (backlog A-2) — group pitches that share a venue under one card
  // ("Redline Sports Complex — 2 pitches"); a standalone turf keeps its own
  // card exactly as before this feature existed.
  const standaloneTurfs = turfs.filter((t) => !t.venue_id);
  const venueGroups = new Map<string, { venue_name: string; turfs: Turf[] }>();
  for (const t of turfs) {
    if (!t.venue_id) continue;
    const group = venueGroups.get(t.venue_id) ?? { venue_name: t.venue_name ?? '', turfs: [] };
    group.turfs.push(t);
    venueGroups.set(t.venue_id, group);
  }

  return (
    <div data-testid="owner-dashboard-page">
      <PageHeader
        title="Dashboard"
        action={
          <Link href="/owner/venues/new">
            <PrimaryButton>+ Add Turf</PrimaryButton>
          </Link>
        }
      />

      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : turfs.length === 0 ? (
        <p className="font-ui text-body text-text-tertiary" data-testid="owner-turfs-empty">
          No turfs yet — add your first one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {Array.from(venueGroups.entries()).map(([venueId, group]) => (
            <Link key={venueId} href={`/owner/venues/${venueId}`}>
              <Card
                className="hover:ring-1 hover:ring-brand-red cursor-pointer"
                data-testid={`venue-card-${venueId}`}
              >
                <p className="font-ui font-bold text-body text-text-primary">{group.venue_name}</p>
                <p className="font-ui text-micro text-text-tertiary mt-1">
                  {group.turfs.length} pitch{group.turfs.length === 1 ? '' : 'es'}
                </p>
              </Card>
            </Link>
          ))}
          {standaloneTurfs.map((t) => (
            <Link key={t.turf_id} href={`/owner/turfs/${t.turf_id}`}>
              <Card
                className="hover:ring-1 hover:ring-brand-red cursor-pointer"
                data-testid={`turf-card-${t.turf_id}`}
              >
                <p className="font-ui font-bold text-body text-text-primary">{t.turf_name}</p>
                <p className="font-ui text-micro text-text-tertiary mt-1">
                  {t.city} · {t.turf_status}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
