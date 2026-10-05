'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ScoringConsole } from '../../../../components/scoring/ScoringConsole';

// Admin-hosted tournament matches are scored here — only by the host.
export default function AdminScoringPage() {
  const params = useParams<{ matchId: string }>();
  return <ScoringConsole matchId={params.matchId} backHref="/admin/tournaments" />;
}
