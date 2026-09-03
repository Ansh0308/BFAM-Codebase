'use client';

import React, { useEffect, useState } from 'react';
import type { OwnerMatch } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader, DataTable } from '../../../components/DashboardShell';

// Match Management (module 2.12, PRD §8.3/§9.2).
export default function OwnerMatchesPage() {
  const [matches, setMatches] = useState<OwnerMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getOwnerMatches()
      .then((res) => setMatches(res.results))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="owner-matches-page">
      <PageHeader title="Match Management" />
      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : (
        <DataTable
          rows={matches}
          keyField="match_id"
          emptyMessage="No matches yet at your turfs."
          columns={[
            { key: 'match_name', label: 'Match', render: (r) => r.match_name ?? 'Match' },
            { key: 'turf_name', label: 'Turf' },
            { key: 'match_status', label: 'Status' },
            {
              key: 'scheduled_start_time',
              label: 'Scheduled',
              render: (r) => new Date(r.scheduled_start_time).toLocaleString(),
            },
          ]}
        />
      )}
    </div>
  );
}
