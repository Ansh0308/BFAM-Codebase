'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OwnerLiveMatch } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader } from '../../../components/DashboardShell';
import { BallLoader } from '../../../components/BallLoader';

// Digital Scoreboard picker (PRD §12.20). An owner may run several pitches
// at once, each with its own PC/LED — this groups every currently-live
// match (innings_status = IN_PROGRESS) by turf so the owner can tell which
// match to open on which physical screen.
export default function OwnerScoreboardPage() {
  const [matches, setMatches] = useState<OwnerLiveMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getOwnerLiveMatches()
      .then((res) => setMatches(res.results))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  // Keyed by turf_id, not turf_name — pitches are auto-named "Pitch 1",
  // "Pitch 2", ... per venue, so an owner with multiple venues commonly has
  // the same turf name at each one and grouping by name would merge them.
  const byTurf = matches.reduce<Record<string, OwnerLiveMatch[]>>((acc, m) => {
    (acc[m.turf_id] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div data-testid="owner-scoreboard-page">
      <PageHeader title="Digital Scoreboard" />
      <p className="font-ui text-body text-text-secondary -mt-4 mb-6">
        Pick a live match to display on a pitch&apos;s LED or TV screen.
      </p>
      {loading ? (
        <BallLoader />
      ) : matches.length === 0 ? (
        <p className="font-ui text-body text-text-secondary" data-testid="scoreboard-empty">
          No matches are live right now.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(byTurf).map(([turfId, turfMatches]) => (
            <div
              key={turfId}
              className="bg-surface-alt rounded-lg border border-border-subtle p-5"
              data-testid="scoreboard-turf-group"
            >
              <h3 className="font-ui font-bold text-title-sm text-ink-black mb-3">
                {turfMatches[0].turf_name}
                {turfMatches[0].venue_name ? ` · ${turfMatches[0].venue_name}` : ''}
              </h3>
              <div className="space-y-3">
                {turfMatches.map((m) => (
                  <div
                    key={m.match_id}
                    className="flex items-center justify-between bg-surface rounded-md border border-border-subtle p-4"
                    data-testid="scoreboard-match-row"
                  >
                    <div>
                      <p className="font-ui font-semibold text-body text-ink-black">
                        {m.match_name ?? 'Live Match'}
                      </p>
                      <p className="font-ui text-micro text-text-secondary mt-0.5">
                        {m.total_runs}/{m.total_wickets} ({m.overs_completed} ov)
                      </p>
                    </div>
                    <Link
                      href={`/owner/scoreboard/${m.match_id}`}
                      target="_blank"
                      className="font-ui font-semibold text-body text-white bg-brand-red rounded-md px-4 py-2"
                      data-testid="scoreboard-open-display"
                    >
                      Open Display
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
