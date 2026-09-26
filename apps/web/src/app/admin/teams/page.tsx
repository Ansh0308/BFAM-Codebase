'use client';

import React, { useEffect, useState } from 'react';
import type { AdminTeam } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import {
  DataTable,
  PageHeader,
  SecondaryButton,
  TextInput,
} from '../../../components/DashboardShell';
import { BallLoader } from '../../../components/BallLoader';

// Backlog E-4 — Team Management in Admin Web (PRD §9.1): a cross-captain
// directory of every team, plus moderation (archive/reactivate). Same
// shape as E-3's Turf Management — see adminTeamService.ts for the full
// reasoning.
export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiClient
      .getAllTeamsAdmin()
      .then((res) => setTeams(res.results))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function setStatus(team: AdminTeam, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') {
    setUpdatingId(team.team_id);
    try {
      await apiClient.setTeamStatusAdmin(team.team_id, status);
      load();
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = query.trim()
    ? teams.filter((t) => {
        const q = query.trim().toLowerCase();
        return (
          t.team_name.toLowerCase().includes(q) ||
          (t.home_city ?? '').toLowerCase().includes(q) ||
          (t.captain_name ?? '').toLowerCase().includes(q) ||
          t.captain_phone.includes(q)
        );
      })
    : teams;

  return (
    <div data-testid="admin-teams-page">
      <PageHeader title={`Teams (${teams.length})`} />

      <div className="max-w-sm mb-4">
        <TextInput
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Team name, city, or captain"
        />
      </div>

      {loading ? (
        <BallLoader />
      ) : loadError ? (
        <p className="font-ui text-body text-brand-red">
          Could not load teams. Your session may have expired — try logging in again.
        </p>
      ) : (
        <DataTable
          rows={filtered}
          keyField="team_id"
          emptyMessage={
            teams.length === 0 ? 'No teams registered yet.' : 'No teams match your search.'
          }
          columns={[
            { key: 'team_name', label: 'Team Name' },
            { key: 'home_city', label: 'City', render: (r) => r.home_city ?? '—' },
            {
              key: 'captain_name',
              label: 'Captain',
              render: (r) => r.captain_name ?? r.captain_phone,
            },
            { key: 'member_count', label: 'Members' },
            { key: 'team_status', label: 'Status' },
            {
              key: 'team_id',
              label: 'Actions',
              render: (r) => (
                <div className="flex gap-2">
                  {r.team_status !== 'ARCHIVED' && (
                    <SecondaryButton
                      onClick={() => setStatus(r, 'ARCHIVED')}
                      disabled={updatingId === r.team_id}
                    >
                      Archive
                    </SecondaryButton>
                  )}
                  {r.team_status !== 'ACTIVE' && (
                    <SecondaryButton
                      onClick={() => setStatus(r, 'ACTIVE')}
                      disabled={updatingId === r.team_id}
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
