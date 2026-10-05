'use client';

import React from 'react';
import { TournamentList } from '../../../components/tournaments/TournamentList';

// Admin Web tournaments (PRD §9.1): platform-wide events.
export default function AdminTournamentsPage() {
  return (
    <TournamentList
      basePath="/admin/tournaments"
      subtitle="Run leagues and knockouts across BFAM. Team captains enter; you approve."
    />
  );
}
