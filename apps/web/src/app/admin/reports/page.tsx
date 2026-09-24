'use client';

import React, { useEffect, useState } from 'react';
import type { BusinessReport } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { Card, PageHeader } from '../../../components/DashboardShell';

// Backlog E-6 — Reports / Business Analytics in Admin Web (PRD §12.49): a
// deliberately small first cut of the KPIs an admin would check day to
// day (bookings, revenue, cancellation rate, active-entity counts) — see
// adminReportsService.ts for what's out of scope for this first build
// (trends over custom date ranges, per-turf/per-owner breakdowns,
// exports).
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="font-ui text-micro uppercase text-text-secondary mb-1">{label}</p>
      <p className="font-ui font-bold text-title-xl text-ink-black">{value}</p>
    </Card>
  );
}

export default function AdminReportsPage() {
  const [report, setReport] = useState<BusinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    apiClient
      .getBusinessReport()
      .then(setReport)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="admin-reports-page">
      <PageHeader title="Reports" />

      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : loadError || !report ? (
        <p className="font-ui text-body text-brand-red">
          Could not load the report. Your session may have expired — try logging in again.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Tile label="Total Bookings" value={String(report.total_bookings)} />
          <Tile label="Cancelled Bookings" value={String(report.cancelled_bookings)} />
          <Tile label="Cancellation Rate" value={`${report.cancellation_rate}%`} />
          <Tile label="Total Revenue" value={`₹${report.total_revenue}`} />
          <Tile label="Total Refunds" value={`₹${report.total_refunds}`} />
          <Tile label="Matches Completed" value={String(report.matches_completed)} />
          <Tile label="Active Players" value={String(report.active_players)} />
          <Tile label="Active Turfs" value={String(report.active_turfs)} />
          <Tile label="Active Teams" value={String(report.active_teams)} />
        </div>
      )}
    </div>
  );
}
