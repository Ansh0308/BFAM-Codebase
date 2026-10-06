'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LogOut, Menu, ShieldAlert, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button } from './ui/kit';
import { EASE_OUT } from './ui/motion';

export interface NavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrator',
  TURF_OWNER: 'Turf Owner',
  TURF_STAFF: 'Turf Staff',
  PLAYER: 'Player',
};

// Desktop-optimized shell shared by Owner, Staff and Admin Web (module 2.12,
// PRD §9): a fixed left sidebar + a sticky top bar + the content canvas — not
// a mobile-style stacked layout. The sidebar collapses to icons below `lg`.
// Below `md` (a phone at the counter) it goes away entirely: a top bar with a
// menu button that opens a slide-over, plus a bottom tab bar for the main pages.
export function DashboardShell({
  title,
  navItems,
  children,
}: {
  title: string;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout, actingAs, stopActingAs } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const current = navItems.find((i) => i.href === pathname)?.label ?? title;
  const [menuOpen, setMenuOpen] = useState(false);
  // Four tabs fit a phone comfortably; the rest live behind "More".
  const tabItems = navItems.length > 5 ? navItems.slice(0, 4) : navItems;
  const hasMore = navItems.length > tabItems.length;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex bg-surface-alt">
      <aside className="hidden md:flex sticky top-0 h-screen w-[76px] lg:w-[264px] shrink-0 border-r border-border-subtle bg-surface flex-col transition-[width] duration-300">
        <div className="relative overflow-hidden px-3 lg:px-6 py-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 -left-8 h-[110px] w-[110px] rounded-[999px] bg-brand-red/10"
          />
          <span className="relative block text-center lg:text-left font-display text-[28px] lg:text-[34px] leading-none text-brand-red uppercase tracking-wide">
            BFAM
          </span>
          <p className="relative hidden lg:block font-ui text-micro uppercase tracking-[0.18em] text-text-tertiary mt-2">
            {title}
          </p>
        </div>

        <nav
          className="flex-1 px-2 lg:px-3 space-y-[2px] overflow-y-auto"
          aria-label={`${title} navigation`}
        >
          {navItems.map((item, index) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <motion.div
                key={item.href}
                initial={reduce ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.05 * index, ease: EASE_OUT }}
              >
                <Link
                  href={item.href}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center justify-center lg:justify-start gap-3 rounded-md px-3 h-[44px] font-ui text-body transition-colors duration-200 ${
                    active
                      ? 'text-white'
                      : 'text-text-secondary hover:text-ink-black hover:bg-ink-black/[0.04]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-md bg-brand-red shadow-[0_8px_22px_rgba(216,0,0,0.32)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    />
                  )}
                  {Icon ? (
                    <Icon
                      className={`relative h-[19px] w-[19px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        active ? '' : 'group-hover:text-brand-red'
                      }`}
                    />
                  ) : null}
                  <span className="relative hidden lg:inline font-semibold">{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="border-t border-border-subtle p-2 lg:p-4">
          <div className="hidden lg:flex items-center gap-3 mb-3">
            <span className="grid h-[38px] w-[38px] place-items-center rounded-[999px] bg-ink-black font-ui text-[13px] font-bold text-white">
              {(user?.role ?? 'U').slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="font-ui text-body font-semibold text-ink-black truncate">
                {user ? (ROLE_LABEL[user.role] ?? user.role) : 'Signed in'}
              </p>
              <p className="font-ui text-micro text-text-tertiary">Online</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="group flex w-full items-center justify-center lg:justify-start gap-2 rounded-md px-3 h-[40px] font-ui text-body font-semibold text-text-tertiary hover:text-brand-red hover:bg-brand-red/5 transition-colors cursor-pointer"
          >
            <LogOut className="h-[18px] w-[18px] transition-transform group-hover:-translate-x-[2px]" />
            <span className="hidden lg:inline">Log Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col bfam-canvas">
        {actingAs && (
          <div
            data-testid="acting-as-banner"
            className="sticky top-0 z-40 flex items-center justify-between gap-4 bg-ink-black px-4 md:px-6 lg:px-10 h-[44px] text-white"
          >
            <p className="flex items-center gap-2 font-ui text-body min-w-0">
              <ShieldAlert className="h-[16px] w-[16px] shrink-0 text-brand-red" />
              <span className="truncate">
                Admin mode — managing as <strong>{actingAs.label}</strong>
                <span className="hidden md:inline">
                  . Changes are saved to their account and recorded in the audit log.
                </span>
              </span>
            </p>
            <button
              onClick={() => {
                stopActingAs();
                router.push('/admin/users');
              }}
              data-testid="acting-as-exit"
              className="shrink-0 rounded-md bg-brand-red px-3 h-[28px] font-ui text-[12px] font-bold uppercase tracking-wide cursor-pointer hover:bg-[#e10600]"
            >
              Exit
            </button>
          </div>
        )}
        <header
          className={`sticky ${actingAs ? 'top-[44px]' : 'top-0'} z-30 flex items-center justify-between gap-4 border-b border-border-subtle bg-surface/85 px-4 md:px-6 lg:px-10 h-[60px] md:h-[64px] backdrop-blur-md`}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            data-testid="mobile-menu"
            className="md:hidden -ml-2 grid h-[44px] w-[44px] shrink-0 place-items-center rounded-md text-ink-black active:bg-ink-black/[0.06] cursor-pointer"
          >
            <Menu className="h-[22px] w-[22px]" />
          </button>
          <div className="min-w-0 flex-1 md:flex-none">
            <p className="font-ui text-micro uppercase tracking-[0.16em] text-text-tertiary">
              {title}
            </p>
            <p className="font-ui text-body font-bold text-ink-black truncate">{current}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline font-ui text-body text-text-secondary">{today}</span>
            <span
              className="relative flex h-[10px] w-[10px]"
              title="Live connection"
              aria-label="Online"
            >
              <span className="absolute inset-0 rounded-[999px] bg-brand-red animate-pulse-ring" />
              <span className="relative h-[10px] w-[10px] rounded-[999px] bg-brand-red" />
            </span>
          </div>
        </header>

        <motion.main
          key={pathname}
          className="flex-1 px-4 md:px-6 lg:px-10 py-5 md:py-8 pb-[96px] md:pb-8 overflow-y-auto"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          {children}
        </motion.main>
      </div>

      <nav
        aria-label={`${title} tabs`}
        data-testid="mobile-tabs"
        className="md:hidden fixed inset-x-0 bottom-0 z-30 flex border-t border-border-subtle bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        {tabItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-[2px] h-[60px] font-ui text-[11px] font-semibold ${
                active ? 'text-brand-red' : 'text-text-tertiary'
              }`}
            >
              {Icon ? <Icon className="h-[22px] w-[22px]" /> : null}
              <span className="truncate max-w-full px-1">{item.label}</span>
            </Link>
          );
        })}
        {hasMore && (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            data-testid="mobile-more"
            className="flex-1 flex flex-col items-center justify-center gap-[2px] h-[60px] font-ui text-[11px] font-semibold text-text-tertiary cursor-pointer"
          >
            <Menu className="h-[22px] w-[22px]" />
            More
          </button>
        )}
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-50" data-testid="mobile-drawer">
            <motion.div
              className="absolute inset-0 bg-ink-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-surface shadow-[0_0_40px_rgba(0,0,0,0.25)]"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <div className="flex items-center justify-between px-5 py-5">
                <div>
                  <span className="block font-display text-[30px] leading-none text-brand-red uppercase tracking-wide">
                    BFAM
                  </span>
                  <p className="font-ui text-micro uppercase tracking-[0.18em] text-text-tertiary mt-2">
                    {title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="grid h-[44px] w-[44px] place-items-center rounded-md text-text-secondary cursor-pointer"
                >
                  <X className="h-[22px] w-[22px]" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 space-y-[2px]">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-md px-3 h-[48px] font-ui text-[15px] font-semibold ${
                        active
                          ? 'bg-brand-red text-white'
                          : 'text-text-secondary active:bg-ink-black/[0.06]'
                      }`}
                    >
                      {Icon ? <Icon className="h-[20px] w-[20px] shrink-0" /> : null}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <div className="border-t border-border-subtle p-3">
                <p className="px-3 pb-2 font-ui text-micro text-text-tertiary">
                  {user ? (ROLE_LABEL[user.role] ?? user.role) : 'Signed in'} · {today}
                </p>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-md px-3 h-[48px] font-ui text-[15px] font-semibold text-text-secondary active:bg-brand-red/5 cursor-pointer"
                >
                  <LogOut className="h-[20px] w-[20px]" />
                  Log Out
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PageHeader({
  title,
  action,
  subtitle,
}: {
  title: string;
  action?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4 mb-5 md:mb-7">
      <div>
        <h1 className="font-display text-[32px] md:text-[40px] leading-none tracking-wide text-ink-black uppercase">
          {title}
        </h1>
        <motion.span
          aria-hidden
          className="mt-3 block h-[4px] rounded-[2px] bg-brand-red"
          initial={{ width: 0 }}
          animate={{ width: 52 }}
          transition={{ duration: 0.5, delay: 0.2, ease: EASE_OUT }}
        />
        {subtitle ? <p className="font-ui text-body text-text-tertiary mt-3">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-surface border border-border-subtle rounded-lg p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.07)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <Button onClick={onClick} disabled={disabled} type={type} size="lg">
      {children}
    </Button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled} size="lg">
      {children}
    </Button>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block mb-4">
      <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 font-ui text-body text-text-primary transition-all duration-200 hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </label>
  );
}

export function DataTable<T>({
  rows,
  columns,
  keyField,
  emptyMessage,
}: {
  rows: T[];
  columns: { key: keyof T; label: string; render?: (row: T) => React.ReactNode }[];
  keyField: keyof T;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="font-ui text-body text-text-tertiary rounded-lg border border-dashed border-border-strong bg-surface px-5 py-8 text-center">
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border-subtle bg-ink-black/[0.025]">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="font-ui text-micro uppercase tracking-wider text-text-secondary py-3 px-4"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <motion.tr
              key={String(row[keyField])}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.035, ease: EASE_OUT }}
              className="border-b border-border-subtle last:border-b-0 transition-colors duration-150 hover:bg-brand-red/[0.035]"
            >
              {columns.map((col) => (
                <td key={String(col.key)} className="font-ui text-body text-text-primary py-3 px-4">
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
