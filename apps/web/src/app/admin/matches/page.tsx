'use client';

import React, { useEffect, useState } from 'react';
import type { AdminMatch } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import {
  DataTable,
  PageHeader,
  SecondaryButton,
  TextInput,
} from '../../../components/DashboardShell';

// Backlog E-2 — Match Management in Admin Web (PRD §9.1): a cross-
// organizer match directory, plus a force-cancel moderation action for a
// disputed or abusive match — see adminMatchService.ts for the full
// reasoning (there's no organizer-facing cancel flow to relax an
// ownership check on, unlike E-3's turf editor).
export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiClient
      .getAllMatchesAdmin()
      .then((res) => setMatches(res.results))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function forceCancel(match: AdminMatch) {
    if (
      !window.confirm(`Force-cancel "${match.match_name ?? 'this match'}"? This cannot be undone.`)
    ) {
      return;
    }
    setCancellingId(match.match_id);
    try {
      await apiClient.forceCancelMatchAdmin(match.match_id);
      load();
    } finally {
      setCancellingId(null);
    }
  }

  const filtered = query.trim()
    ? matches.filter((m) => {
        const q = query.trim().toLowerCase();
        return (
          (m.match_name ?? '').toLowerCase().includes(q) ||
          (m.organizer_name ?? '').toLowerCase().includes(q) ||
          m.organizer_phone.includes(q) ||
          (m.turf_name ?? '').toLowerCase().includes(q)
        );
      })
    : matches;

  const canCancel = (status: string) => status !== 'COMPLETED' && status !== 'CANCELLED';

  return (
    <div data-testid="admin-matches-page">
      <PageHeader title={`Matches (${matches.length})`} />

      <div className="max-w-sm mb-4">
        <TextInput
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Match name, organizer, or turf"
        />
      </div>

      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : loadError ? (
        <p className="font-ui text-body text-brand-red">
          Could not load matches. Your session may have expired — try logging in again.
        </p>
      ) : (
        <DataTable
          rows={filtered}
          keyField="match_id"
          emptyMessage={
            matches.length === 0 ? 'No matches created yet.' : 'No matches match your search.'
          }
          columns={[
            {
              key: 'match_name',
              label: 'Match',
              render: (r) => r.match_name ?? '—',
            },
            { key: 'turf_name', label: 'Turf', render: (r) => r.turf_name ?? '—' },
            {
              key: 'organizer_name',
              label: 'Organizer',
              render: (r) => r.organizer_name ?? r.organizer_phone,
            },
            {
              key: 'scheduled_start_time',
              label: 'Scheduled',
              render: (r) => new Date(r.scheduled_start_time).toLocaleString(),
            },
            { key: 'match_status', label: 'Status' },
            {
              key: 'match_id',
              label: 'Actions',
              render: (r) =>
                canCancel(r.match_status) ? (
                  <SecondaryButton
                    onClick={() => forceCancel(r)}
                    disabled={cancellingId === r.match_id}
                  >
                    Force Cancel
                  </SecondaryButton>
                ) : (
                  <span className="font-ui text-micro text-text-tertiary">—</span>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
