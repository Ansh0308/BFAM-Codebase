'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '../../../../lib/apiClient';
import { TournamentView } from '../../../../components/tournaments/TournamentView';

// Admin events have no home turf, so the host picks the turf per match.
const loadTurfs = () =>
  apiClient
    .getAllTurfsAdmin()
    .then((res) =>
      res.results
        .filter((t) => t.turf_status === 'ACTIVE')
        .map((t) => ({ turf_id: t.turf_id, turf_name: t.turf_name })),
    );

export default function AdminTournamentPage() {
  const params = useParams<{ id: string }>();
  return (
    <TournamentView
      tournamentId={params.id}
      backHref="/admin/tournaments"
      scoringBase="/admin/scoring"
      loadTurfs={loadTurfs}
    />
  );
}
