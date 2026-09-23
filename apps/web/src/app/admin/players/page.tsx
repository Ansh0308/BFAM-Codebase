'use client';

import React, { useEffect, useState } from 'react';
import type { AdminPlayer } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader, DataTable, TextInput } from '../../../components/DashboardShell';

// Admin Web — User management, player directory (PRD §9.1). Every
// registered PLAYER account.
export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    apiClient
      .getAllPlayers()
      .then((res) => setPlayers(res.results))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = query.trim()
    ? players.filter((p) => {
        const q = query.trim().toLowerCase();
        return (
          (p.full_name ?? '').toLowerCase().includes(q) ||
          p.bfam_id.toLowerCase().includes(q) ||
          p.phone_number.includes(q) ||
          (p.email ?? '').toLowerCase().includes(q) ||
          (p.city ?? '').toLowerCase().includes(q)
        );
      })
    : players;

  return (
    <div data-testid="admin-players-page">
      <PageHeader title={`Players (${players.length})`} />

      <div className="max-w-sm mb-4">
        <TextInput
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Name, BFAM ID, phone, email, or city"
        />
      </div>

      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : loadError ? (
        <p className="font-ui text-body text-brand-red">
          Could not load players. Your session may have expired — try logging in again.
        </p>
      ) : (
        <DataTable
          rows={filtered}
          keyField="user_id"
          emptyMessage={
            players.length === 0 ? 'No players registered yet.' : 'No players match your search.'
          }
          columns={[
            { key: 'full_name', label: 'Name', render: (r) => r.full_name ?? '—' },
            { key: 'bfam_id', label: 'BFAM ID' },
            { key: 'phone_number', label: 'Phone' },
            { key: 'city', label: 'City', render: (r) => r.city ?? '—' },
            {
              key: 'playing_role',
              label: 'Role',
              render: (r) => r.playing_role ?? '—',
            },
            { key: 'skill_rating', label: 'Skill Rating' },
            { key: 'account_status', label: 'Status' },
            {
              key: 'created_at',
              label: 'Joined',
              render: (r) => new Date(r.created_at).toLocaleDateString(),
            },
          ]}
        />
      )}
    </div>
  );
}
