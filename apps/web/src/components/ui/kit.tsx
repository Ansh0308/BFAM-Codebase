'use client';

import React, { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Loader2, Search, type LucideIcon } from 'lucide-react';
import { CountUp, EASE_OUT } from './motion';

// ---- Button ---------------------------------------------------------------
//
// One button with four looks. Press = quick scale-down, hover = lift, the
// primary variant gets a one-off light sweep on hover.
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft';

const BUTTON_BASE =
  'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-md font-ui font-bold uppercase tracking-wide select-none cursor-pointer transition-[background-color,border-color,color,box-shadow] duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-red text-white shadow-[0_6px_18px_rgba(216,0,0,0.28)] hover:bg-[#e10600] hover:shadow-[0_10px_26px_rgba(216,0,0,0.36)]',
  secondary:
    'bg-surface border border-brand-red text-brand-red hover:bg-brand-red/5 hover:shadow-[0_6px_18px_rgba(216,0,0,0.12)]',
  ghost: 'text-text-secondary hover:text-brand-red hover:bg-brand-red/5',
  soft: 'bg-ink-black/[0.04] text-ink-black hover:bg-ink-black/[0.08]',
};

const BUTTON_SIZES = {
  sm: 'text-[12px] px-3 h-[34px]',
  md: 'text-[13px] px-4 h-[40px]',
  lg: 'text-[14px] px-6 h-[48px]',
} as const;

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  type = 'button',
  className = '',
  testID,
  ariaLabel,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  type?: 'button' | 'submit';
  className?: string;
  testID?: string;
  ariaLabel?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      data-testid={testID}
      whileHover={reduce || disabled ? undefined : { y: -1 }}
      whileTap={reduce || disabled ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.15, ease: EASE_OUT }}
      className={`group ${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    >
      {variant === 'primary' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[40%] bg-white/25 -translate-x-[120%] skew-x-[-18deg] group-hover:animate-sheen"
        />
      )}
      {loading ? (
        <Loader2 className="h-[16px] w-[16px] animate-spin" />
      ) : Icon ? (
        <Icon className="h-[16px] w-[16px]" />
      ) : null}
      {children}
    </motion.button>
  );
}

// ---- Status pill ----------------------------------------------------------

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const TONES: Record<Tone, string> = {
  success: 'bg-status-success-bg text-status-success',
  warning: 'bg-status-warning-bg text-status-warning',
  danger: 'bg-status-danger-bg text-status-danger',
  info: 'bg-status-info-bg text-status-info',
  neutral: 'bg-status-neutral-bg text-status-neutral',
  brand: 'bg-brand-red/10 text-brand-red',
};

export function StatusPill({
  label,
  tone = 'neutral',
  pulse = false,
}: {
  label: string;
  tone?: Tone;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-[6px] rounded-[999px] px-[10px] h-[24px] font-ui text-[11px] font-bold uppercase tracking-wide ${TONES[tone]}`}
    >
      {pulse && (
        <span className="relative flex h-[8px] w-[8px]">
          <span className="absolute inset-0 rounded-[999px] bg-current animate-pulse-ring" />
          <span className="relative h-[8px] w-[8px] rounded-[999px] bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}

// ---- Stat tile ------------------------------------------------------------

export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  prefix,
  suffix,
  delay = 0,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
  prefix?: string;
  suffix?: string;
  delay?: number;
  tone?: 'default' | 'brand';
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={`group relative overflow-hidden rounded-lg border p-5 transition-shadow duration-300 hover:shadow-[0_14px_34px_rgba(0,0,0,0.08)] ${
        tone === 'brand'
          ? 'border-transparent bg-ink-black text-white'
          : 'border-border-subtle bg-surface'
      }`}
      data-testid={`stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
    >
      <div
        aria-hidden
        className={`absolute -right-6 -top-6 h-[96px] w-[96px] rounded-[999px] transition-transform duration-500 group-hover:scale-125 ${
          tone === 'brand' ? 'bg-brand-red/30' : 'bg-brand-red/[0.07]'
        }`}
      />
      <div className="relative flex items-start justify-between">
        <p
          className={`font-ui text-micro uppercase tracking-wider ${
            tone === 'brand' ? 'text-white/70' : 'text-text-tertiary'
          }`}
        >
          {label}
        </p>
        <span
          className={`grid h-[34px] w-[34px] place-items-center rounded-md ${
            tone === 'brand' ? 'bg-white/10 text-white' : 'bg-brand-red/10 text-brand-red'
          }`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="relative mt-3 font-display text-[44px] leading-none tracking-wide">
        <CountUp value={value} prefix={prefix} suffix={suffix} />
      </p>
      {hint ? (
        <p
          className={`relative mt-2 font-ui text-[12px] ${
            tone === 'brand' ? 'text-white/60' : 'text-text-tertiary'
          }`}
        >
          {hint}
        </p>
      ) : null}
    </motion.div>
  );
}

// ---- Skeleton / empty -----------------------------------------------------

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer animate-shimmer rounded-md ${className}`} aria-hidden />;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[76px] w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  testID,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: React.ReactNode;
  testID?: string;
}) {
  return (
    <div
      className="flex flex-col items-center text-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-14"
      data-testid={testID}
    >
      <div className="relative mb-5 grid h-[72px] w-[72px] place-items-center">
        <span className="absolute inset-0 rounded-[999px] bg-brand-red/10 animate-pulse-ring" />
        <span className="relative grid h-[72px] w-[72px] place-items-center rounded-[999px] bg-brand-red/10 text-brand-red animate-float-slow">
          <Icon className="h-[30px] w-[30px]" />
        </span>
      </div>
      <h3 className="font-display text-[26px] tracking-wide text-ink-black uppercase">{title}</h3>
      <p className="font-ui text-body text-text-tertiary mt-2 max-w-[360px]">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// ---- Segmented control (sliding highlight) ---------------------------------

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  testIDPrefix: string;
}) {
  const groupId = useId();
  return (
    <div
      role="tablist"
      className="inline-flex rounded-md bg-ink-black/[0.05] p-[4px]"
      data-testid={`${testIDPrefix}-tabs`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            data-testid={`${testIDPrefix}-${opt.value}`}
            className={`relative px-4 h-[34px] rounded-md font-ui text-[13px] font-semibold cursor-pointer transition-colors duration-200 ${
              active ? 'text-white' : 'text-text-secondary hover:text-ink-black'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 rounded-md bg-brand-red shadow-[0_4px_14px_rgba(216,0,0,0.3)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-[6px]">
              {opt.label}
              {opt.count !== undefined && (
                <span
                  className={`rounded-[999px] px-[7px] text-[11px] leading-[18px] ${
                    active ? 'bg-white/25' : 'bg-ink-black/[0.07]'
                  }`}
                >
                  {opt.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Search input ----------------------------------------------------------

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  testID,
  ariaLabel,
  loading = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  testID?: string;
  ariaLabel: string;
  loading?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-surface px-4 h-[46px] transition-all duration-200 ${
        focused
          ? 'border-brand-red shadow-[0_0_0_4px_rgba(216,0,0,0.1)]'
          : 'border-border-strong hover:border-text-tertiary'
      }`}
    >
      {loading ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin text-brand-red" />
      ) : (
        <Search
          className={`h-[18px] w-[18px] transition-colors ${focused ? 'text-brand-red' : 'text-text-tertiary'}`}
        />
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-testid={testID}
        className="flex-1 bg-transparent font-ui text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
      {onSubmit && value.trim() ? (
        <kbd className="hidden sm:block rounded border border-border-strong px-[6px] py-[2px] font-ui text-[11px] text-text-tertiary">
          Enter
        </kbd>
      ) : null}
    </div>
  );
}

// ---- Avatar (initials) -------------------------------------------------------

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[999px] bg-ink-black font-ui font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials || '•'}
    </span>
  );
}
