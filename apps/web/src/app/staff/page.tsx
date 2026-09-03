'use client';

import React, { useEffect, useState } from 'react';
import type { OwnerBooking } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { PageHeader, DataTable } from '../../components/DashboardShell';

// Today's Bookings (module 2.12, PRD §8.4/§9.3) — bookings at any turf
// this staff member is assigned to.
export default function StaffBookingsPage() {
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getStaffTodaysBookings()
      .then((res) => setBookings(res.results))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="staff-bookings-page">
      <PageHeader title="Today's Bookings" />
      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : (
        <DataTable
          rows={bookings}
          keyField="booking_id"
          emptyMessage="No bookings today at your assigned turf(s)."
          columns={[
            { key: 'turf_name', label: 'Turf' },
            {
              key: 'start_time',
              label: 'Time',
              render: (r) => `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`,
            },
            { key: 'booking_status', label: 'Status' },
          ]}
        />
      )}
    </div>
  );
}
