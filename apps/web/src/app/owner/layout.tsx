'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useRequireRole } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';

const NAV_ITEMS = [
  { href: '/owner', label: 'Dashboard' },
  { href: '/owner/bookings', label: "Today's Bookings" },
  { href: '/owner/matches', label: 'Match Management' },
  { href: '/owner/staff', label: 'Staff Management' },
  { href: '/owner/payments', label: 'Payments' },
  { href: '/owner/scoreboard', label: 'Scoreboard' },
];

// Owner Web (module 2.12, PRD §9.2) — same functionality as Owner Mobile,
// desktop-optimized layout, not a stripped-down subset. Every page under
// this layout calls the exact same apiClient methods (@bfam/api-client)
// Owner Mobile calls — requirement 6.
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireRole('TURF_OWNER');
  const pathname = usePathname();

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      </div>
    );
  }

  // The per-match scoreboard display (/owner/scoreboard/[matchId]) is meant
  // to run full screen on an LED/TV, not inside the dashboard chrome — skip
  // the sidebar shell for it while keeping the same TURF_OWNER auth gate.
  const isScoreboardDisplay = /^\/owner\/scoreboard\/[^/]+$/.test(pathname ?? '');
  if (isScoreboardDisplay) {
    return <>{children}</>;
  }

  return (
    <DashboardShell title="Owner Portal" navItems={NAV_ITEMS}>
      {children}
    </DashboardShell>
  );
}
