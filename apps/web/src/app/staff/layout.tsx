'use client';

import React from 'react';
import { useRequireRole } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';
import { BallLoader } from '../../components/BallLoader';
import { ClipboardCheck, ShieldCheck, Swords } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/staff', label: "Today's Desk", icon: ClipboardCheck },
  { href: '/staff/matches', label: 'Match Operations', icon: Swords },
  { href: '/staff/verification', label: 'Verification', icon: ShieldCheck },
];

// Staff Web (module 2.12, PRD §9.3) — a desk-based alternative to Staff
// Mobile, same functionality, same apiClient calls (requirement 6).
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireRole('TURF_STAFF');

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <BallLoader />
      </div>
    );
  }

  return (
    <DashboardShell title="Staff Portal" navItems={NAV_ITEMS}>
      {children}
    </DashboardShell>
  );
}
