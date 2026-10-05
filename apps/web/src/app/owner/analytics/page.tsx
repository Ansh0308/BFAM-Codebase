'use client';

import React, { useEffect, useState } from 'react';
import type { Turf } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { AnalyticsDashboard } from '../../../components/analytics/AnalyticsDashboard';

const load = (filters: { from: string; to: string; turf_id?: string }) =>
  apiClient.getOwnerAnalytics(filters);

// Owner Analytics (PRD §9.2 / §23.1): revenue, occupancy, peak hours and
// customers across the owner's turfs, with a per-turf filter.
export default function OwnerAnalyticsPage() {
  const [turfs, setTurfs] = useState<Turf[]>([]);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => setTurfs(res.results))
      .catch(() => setTurfs([]));
  }, []);

  return (
    <AnalyticsDashboard
      title="Analytics"
      subtitle="How your turfs are performing."
      load={load}
      turfs={turfs}
    />
  );
}
