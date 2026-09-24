'use client';

import React from 'react';
import { useRequireRole } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';

const NAV_ITEMS = [
  { href: '/admin/players', label: 'Players' },
  { href: '/admin/turfs', label: 'Turfs' },
  { href: '/admin/banners', label: 'Home Banners' },
];

// Admin Web (PRD §9.1) — web-only, no mobile equivalent (unlike Owner/
// Staff, which get both). Started with just the player directory; backlog
// B-6 added the Home page carousel's content-management surface, and
// backlog E-3 added a cross-owner turf directory + suspend/reactivate
// moderation (deliberately not the fuller pricing/hours editor Owner Web
// already has — see adminTurfService.ts). The rest of §9.1's scope
// (tournament management, payment oversight, reports) is a larger,
// separate build.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireRole('ADMIN');

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      </div>
    );
  }

  return (
    <DashboardShell title="Admin Portal" navItems={NAV_ITEMS}>
      {children}
    </DashboardShell>
  );
}
