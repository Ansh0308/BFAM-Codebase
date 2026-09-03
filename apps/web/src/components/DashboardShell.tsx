'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth';

export interface NavItem {
  href: string;
  label: string;
}

// Desktop-optimized shell shared by Owner Web and Staff Web (module 2.12,
// PRD §9.2/§9.3): a fixed left sidebar + content area, not a mobile-style
// stacked layout — the point of a web dashboard being desktop-optimized,
// not a stripped-down mobile view squeezed onto a bigger screen.
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
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface flex">
      <aside className="w-64 shrink-0 border-r border-border-subtle bg-surface-alt flex flex-col">
        <div className="px-6 py-6">
          <span className="font-display text-title-xl text-brand-red uppercase">BFAM</span>
          <p className="font-ui text-micro text-text-tertiary mt-1">{title}</p>
        </div>
        <nav className="flex-1 px-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 mb-1 font-ui text-body ${
                  active ? 'bg-brand-red text-white' : 'text-text-primary hover:bg-surface'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-6">
          <button
            onClick={logout}
            className="font-ui text-body text-text-tertiary hover:text-brand-red"
          >
            Log Out
          </button>
        </div>
      </aside>
      <main className="flex-1 px-10 py-8 overflow-y-auto">{children}</main>
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="font-ui font-bold text-title-xl text-ink-black">{title}</h1>
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
    <div className={`bg-surface-alt rounded-lg p-5 ${className}`} {...rest}>
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
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="font-ui font-bold text-button uppercase bg-brand-red text-white rounded-md px-5 py-2.5 disabled:opacity-50"
    >
      {children}
    </button>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-ui font-bold text-button uppercase border border-brand-red text-brand-red rounded-md px-5 py-2.5 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
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
        className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 font-ui text-body text-text-primary focus:border-brand-red focus:outline-none"
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
    return <p className="font-ui text-body text-text-tertiary">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="font-ui text-micro uppercase tracking-wide text-text-secondary py-2 pr-4"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[keyField])} className="border-b border-border-subtle">
              {columns.map((col) => (
                <td key={String(col.key)} className="font-ui text-body text-text-primary py-3 pr-4">
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
