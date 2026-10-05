'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { TournamentView } from '../../../../components/tournaments/TournamentView';

export default function OwnerTournamentPage() {
  const params = useParams<{ id: string }>();
  return <TournamentView tournamentId={params.id} backHref="/owner/tournaments" />;
}
