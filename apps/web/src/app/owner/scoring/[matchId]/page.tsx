'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ScoringConsole } from '../../../../components/scoring/ScoringConsole';

// Owner Web live-scoring console (module 2.12, PRD §9.2).
export default function OwnerScoringPage() {
  const params = useParams<{ matchId: string }>();
  return <ScoringConsole matchId={params.matchId} backHref="/owner/matches" />;
}
