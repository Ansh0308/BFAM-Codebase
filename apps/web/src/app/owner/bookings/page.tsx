'use client';

import React, { useEffect, useState } from 'react';
import type { OwnerBooking } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader, DataTable } from '../../../components/DashboardShell';

// Today's Bookings (module 2.12, PRD §8.3/§9.2).
export default function OwnerBookingsPage() {
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getOwnerTodaysBookings()
      .then((res) => setBookings(res.results))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="owner-bookings-page">
      <PageHeader title="Today's Bookings" />
      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : (
        <DataTable
          rows={bookings}
          keyField="booking_id"
          emptyMessage="No bookings today."
          columns={[
            { key: 'turf_name', label: 'Turf' },
            {
              key: 'start_time',
              label: 'Time',
              render: (r) => `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`,
            },
            { key: 'booking_status', label: 'Status' },
            { key: 'booking_amount', label: 'Amount', render: (r) => `₹${r.booking_amount}` },
          ]}
        />
      )}
    </div>
  );
}
