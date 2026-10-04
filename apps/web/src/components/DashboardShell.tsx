'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { LogOut, ShieldAlert, type LucideIcon } from 'lucide-react';
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
// a mobile-style stacked layout. The sidebar collapses to icons below `lg`
// so it still works on a tablet or a phone at the desk.
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

  return (
    <div className="min-h-screen flex bg-surface-alt">
      <aside className="sticky top-0 h-screen w-[76px] lg:w-[264px] shrink-0 border-r border-border-subtle bg-surface flex flex-col transition-[width] duration-300">
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
            className="sticky top-0 z-40 flex items-center justify-between gap-4 bg-ink-black px-6 lg:px-10 h-[44px] text-white"
          >
            <p className="flex items-center gap-2 font-ui text-body min-w-0">
              <ShieldAlert className="h-[16px] w-[16px] shrink-0 text-brand-red" />
              <span className="truncate">
                Admin mode — managing as <strong>{actingAs.label}</strong>. Changes are saved to
                their account and recorded in the audit log.
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
          className={`sticky ${actingAs ? 'top-[44px]' : 'top-0'} z-30 flex items-center justify-between gap-4 border-b border-border-subtle bg-surface/85 px-6 lg:px-10 h-[64px] backdrop-blur-md`}
        >
          <div className="min-w-0">
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
          className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          {children}
        </motion.main>
      </div>
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
    <div className="flex items-end justify-between gap-4 mb-7">
      <div>
        <h1 className="font-display text-[40px] leading-none tracking-wide text-ink-black uppercase">
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
