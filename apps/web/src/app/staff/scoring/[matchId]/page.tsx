'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ScoringConsole } from '../../../../components/scoring/ScoringConsole';

// Staff Web live-scoring console (module 2.12, PRD §9.3).
export default function StaffScoringPage() {
  const params = useParams<{ matchId: string }>();
  return <ScoringConsole matchId={params.matchId} backHref="/staff/matches" />;
}
