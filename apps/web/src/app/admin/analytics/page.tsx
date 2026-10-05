'use client';

import React from 'react';
import { apiClient } from '../../../lib/apiClient';
import { AnalyticsDashboard } from '../../../components/analytics/AnalyticsDashboard';

const load = (filters: { from: string; to: string; turf_id?: string }) =>
  apiClient.getAdminAnalytics(filters);

// Admin Analytics (PRD §9.1 / §23.2): the same figures for the whole platform,
// plus player growth and a ranking of the top turfs.
export default function AdminAnalyticsPage() {
  return (
    <AnalyticsDashboard
      title="Analytics"
      subtitle="Bookings, revenue and growth across BFAM."
      load={load}
      platform
    />
  );
}
