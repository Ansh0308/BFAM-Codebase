'use client';

import React, { useEffect, useState } from 'react';
import type { AdminTurf } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import {
  DataTable,
  PageHeader,
  SecondaryButton,
  TextInput,
} from '../../../components/DashboardShell';

// Backlog E-3 — Turf Management in Admin Web (PRD §9.1): a cross-owner
// directory of every turf, plus moderation (suspend/reactivate). Owner
// Web already owns the fuller pricing/hours/blocks editing UI, scoped to
// "turfs I own" — this page is deliberately just the directory + status
// change, not a duplicate of that editor (see adminTurfService.ts for the
// full reasoning).
export default function AdminTurfsPage() {
  const [turfs, setTurfs] = useState<AdminTurf[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiClient
      .getAllTurfsAdmin()
      .then((res) => setTurfs(res.results))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function setStatus(turf: AdminTurf, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    setUpdatingId(turf.turf_id);
    try {
      await apiClient.setTurfStatusAdmin(turf.turf_id, status);
      load();
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = query.trim()
    ? turfs.filter((t) => {
        const q = query.trim().toLowerCase();
        return (
          t.turf_name.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          (t.owner_name ?? '').toLowerCase().includes(q) ||
          t.owner_phone.includes(q)
        );
      })
    : turfs;

  return (
    <div data-testid="admin-turfs-page">
      <PageHeader title={`Turfs (${turfs.length})`} />

      <div className="max-w-sm mb-4">
        <TextInput
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Turf name, city, or owner"
        />
      </div>

      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : loadError ? (
        <p className="font-ui text-body text-brand-red">
          Could not load turfs. Your session may have expired — try logging in again.
        </p>
      ) : (
        <DataTable
          rows={filtered}
          keyField="turf_id"
          emptyMessage={
            turfs.length === 0 ? 'No turfs registered yet.' : 'No turfs match your search.'
          }
          columns={[
            { key: 'turf_name', label: 'Turf Name' },
            { key: 'city', label: 'City' },
            {
              key: 'owner_name',
              label: 'Owner',
              render: (r) => r.owner_name ?? r.owner_phone,
            },
            { key: 'turf_status', label: 'Status' },
            {
              key: 'turf_id',
              label: 'Actions',
              render: (r) => (
                <div className="flex gap-2">
                  {r.turf_status !== 'SUSPENDED' && (
                    <SecondaryButton
                      onClick={() => setStatus(r, 'SUSPENDED')}
                      disabled={updatingId === r.turf_id}
                    >
                      Suspend
                    </SecondaryButton>
                  )}
                  {r.turf_status !== 'ACTIVE' && (
                    <SecondaryButton
                      onClick={() => setStatus(r, 'ACTIVE')}
                      disabled={updatingId === r.turf_id}
                    >
                      Reactivate
                    </SecondaryButton>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
