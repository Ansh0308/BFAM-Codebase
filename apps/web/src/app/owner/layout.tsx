'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useRequireRole } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';
import { BallLoader } from '../../components/BallLoader';
import {
  BarChart3,
  CalendarCheck,
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  Swords,
  Tag,
  Trophy,
  Users,
  Wrench,
  Tv,
  UserCog,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/owner', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/owner/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/owner/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '/owner/availability', label: 'Availability', icon: CalendarRange },
  { href: '/owner/tournaments', label: 'Tournaments', icon: Trophy },
  { href: '/owner/matches', label: 'Match Management', icon: Swords },
  { href: '/owner/customers', label: 'Customers', icon: Users },
  { href: '/owner/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/owner/staff', label: 'Staff Management', icon: UserCog },
  { href: '/owner/offers', label: 'Offers', icon: Tag },
  { href: '/owner/payments', label: 'Payments & Cash', icon: CreditCard },
  { href: '/owner/scoreboard', label: 'Scoreboard', icon: Tv },
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
        <BallLoader />
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
