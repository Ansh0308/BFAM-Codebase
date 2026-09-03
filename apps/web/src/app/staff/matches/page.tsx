'use client';

import React, { useEffect, useState } from 'react';
import type { OwnerMatch } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader, DataTable } from '../../../components/DashboardShell';

// Match Operations (module 2.12, PRD §8.4/§9.3) — start/manage matches,
// incl. the countdown intro sequence and turf-managed live scoring;
// matches at any turf this staff member is assigned to. This dashboard
// links out to the same match detail flow rather than reimplementing it —
// the web app has no separate live-scoring UI (requirement 6, and Live
// Score Control specifically is a real-time, tap-per-ball interface best
// left to the module 2.8 screen it already has).
export default function StaffMatchesPage() {
  const [matches, setMatches] = useState<OwnerMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getStaffMatches()
      .then((res) => setMatches(res.results))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="staff-matches-page">
      <PageHeader title="Match Operations" />
      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : (
        <DataTable
          rows={matches}
          keyField="match_id"
          emptyMessage="No matches yet at your assigned turf(s)."
          columns={[
            { key: 'match_name', label: 'Match', render: (r) => r.match_name ?? 'Match' },
            { key: 'turf_name', label: 'Turf' },
            { key: 'match_status', label: 'Status' },
          ]}
        />
      )}
    </div>
  );
}
