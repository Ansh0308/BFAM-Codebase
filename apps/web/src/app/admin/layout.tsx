'use client';

import React from 'react';
import { useRequireRole } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';

const NAV_ITEMS = [
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/players', label: 'Players' },
  { href: '/admin/matches', label: 'Matches' },
  { href: '/admin/turfs', label: 'Turfs' },
  { href: '/admin/teams', label: 'Teams' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/banners', label: 'Home Banners' },
];

// Admin Web (PRD §9.1) — web-only, no mobile equivalent (unlike Owner/
// Staff, which get both). Started with just the player directory; backlog
// B-6 added the Home page carousel's content-management surface, backlog
// E-3 added a cross-owner turf directory + suspend/reactivate moderation
// (deliberately not the fuller pricing/hours editor Owner Web already
// has — see adminTurfService.ts), backlog E-5 added a cross-turf review
// directory + delete moderation (adminReviewService.ts), backlog E-4
// added a cross-captain team directory + archive/reactivate moderation
// (adminTeamService.ts), backlog E-2 added a cross-organizer match
// directory + force-cancel moderation (adminMatchService.ts), and
// backlog E-6 added a first-cut business metrics report
// (adminReportsService.ts) — this closes out the original E-2..E-6 gap
// list. The rest of §9.1's scope (tournament management, payment
// oversight) and the fuller analytics platform PRD §12.49/§12.50 imply
// eventually are larger, separate builds.
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
