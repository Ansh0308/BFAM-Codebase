'use client';

import React from 'react';
import { useRequireRole } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';
import { BallLoader } from '../../components/BallLoader';
import {
  BarChart3,
  CalendarCheck,
  Database,
  Hash,
  ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  ScrollText,
  Star,
  Swords,
  Ticket,
  Users,
  UserCog,
  UsersRound,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy },
  { href: '/admin/users', label: 'Users', icon: UserCog },
  { href: '/admin/players', label: 'Players', icon: Users },
  { href: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '/admin/matches', label: 'Matches', icon: Swords },
  { href: '/admin/turfs', label: 'Turfs', icon: MapPin },
  { href: '/admin/teams', label: 'Teams', icon: UsersRound },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/promos', label: 'Promo Codes', icon: Ticket },
  { href: '/admin/bfam-ids', label: 'BFAM IDs', icon: Hash },
  { href: '/admin/banners', label: 'Home Banners', icon: ImageIcon },
  { href: '/admin/data', label: 'Data Explorer', icon: Database },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
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
        <BallLoader />
      </div>
    );
  }

  return (
    <DashboardShell title="Admin Portal" navItems={NAV_ITEMS}>
      {children}
    </DashboardShell>
  );
}
