'use client';

import React, { useEffect, useState } from 'react';
import type { Turf } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { TournamentList } from '../../../components/tournaments/TournamentList';

// Owner Web tournaments (PRD §9.2): events hosted at the owner's own turfs.
export default function OwnerTournamentsPage() {
  const [turfs, setTurfs] = useState<Turf[]>([]);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => setTurfs(res.results))
      .catch(() => setTurfs([]));
  }, []);

  return (
    <TournamentList
      basePath="/owner/tournaments"
      subtitle="Host leagues and knockouts at your turfs."
      turfs={turfs}
    />
  );
}
