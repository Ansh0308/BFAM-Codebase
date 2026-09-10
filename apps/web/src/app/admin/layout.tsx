'use client';

import React from 'react';
import { useRequireRole } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';

const NAV_ITEMS = [
  { href: '/admin/players', label: 'Players' },
  { href: '/admin/banners', label: 'Home Banners' },
];

// Admin Web (PRD §9.1) — web-only, no mobile equivalent (unlike Owner/
// Staff, which get both). Started with just the player directory; backlog
// B-6 adds the Home page carousel's content-management surface. The rest
// of §9.1's scope (turf/owner management, tournament management, payment
// oversight, reports) is a larger, separate build.
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
