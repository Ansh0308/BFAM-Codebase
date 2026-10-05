'use client';

import React, { useEffect, useState } from 'react';
import type { AdminTurf } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { AnalyticsDashboard } from '../../../components/analytics/AnalyticsDashboard';

const load = (filters: { from: string; to: string; turf_id?: string }) =>
  apiClient.getAdminAnalytics(filters);

// Admin Analytics (PRD §9.1 / §23.2): the same figures for the whole platform,
// plus player growth and a ranking of the top turfs.
export default function AdminAnalyticsPage() {
  // A turf filter doubles as per-turf performance (AW-11).
  const [turfs, setTurfs] = useState<AdminTurf[]>([]);

  useEffect(() => {
    apiClient
      .getAllTurfsAdmin()
      .then((res) => setTurfs(res.results.filter((t) => t.turf_status !== 'PENDING_APPROVAL')))
      .catch(() => setTurfs([]));
  }, []);

  return (
    <AnalyticsDashboard
      title="Analytics"
      subtitle="Bookings, revenue and growth across BFAM."
      load={load}
      turfs={turfs}
      platform
    />
  );
}
