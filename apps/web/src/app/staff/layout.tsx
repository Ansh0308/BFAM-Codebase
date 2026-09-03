'use client';

import React from 'react';
import { useRequireRole } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';

const NAV_ITEMS = [
  { href: '/staff', label: "Today's Bookings" },
  { href: '/staff/matches', label: 'Match Operations' },
  { href: '/staff/verification', label: 'Verification' },
];

// Staff Web (module 2.12, PRD §9.3) — a desk-based alternative to Staff
// Mobile, same functionality, same apiClient calls (requirement 6).
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireRole('TURF_STAFF');

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      </div>
    );
  }

  return (
    <DashboardShell title="Staff Portal" navItems={NAV_ITEMS}>
      {children}
    </DashboardShell>
  );
}
