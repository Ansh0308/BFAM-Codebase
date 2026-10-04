'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  CalendarCheck,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  Swords,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useAuth, BFAMApiError } from '../../lib/auth';
import { EASE_OUT } from '../../components/ui/motion';

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Bookings, live',
    text: 'Every slot, customer and payment in one place.',
  },
  {
    icon: Swords,
    title: 'Matches & scoring',
    text: 'Rosters, check-in and a scoreboard for the big screen.',
  },
  {
    icon: ShieldCheck,
    title: 'Run it with confidence',
    text: 'Cash reconciliation, audit trail and staff verification.',
  },
];

const ROLES = ['Turf Owner', 'Turf Staff', 'Admin'];

// Owner Web / Staff Web / Admin Web login — same POST /auth/login endpoint
// the mobile app uses (module 2.12 requirement 6; Admin is web-only, no
// mobile equivalent). Routes by role after success: TURF_OWNER -> /owner,
// TURF_STAFF -> /staff, ADMIN -> /admin.
export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [shakes, setShakes] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(identifier, password);
      const target =
        user.role === 'TURF_OWNER'
          ? '/owner'
          : user.role === 'TURF_STAFF'
            ? '/staff'
            : user.role === 'ADMIN'
              ? '/admin'
              : null;
      if (!target) {
        setError('This portal is for Turf Owner, Turf Staff, and Admin accounts only.');
        setShakes((n) => n + 1);
        return;
      }
      setWelcome(true);
      // A beat for the success state to land before the page changes.
      setTimeout(() => router.replace(target), reduce ? 0 : 650);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not sign in.');
      setShakes((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  const field =
    'peer h-[54px] w-full rounded-lg border border-border-strong bg-surface pl-12 pr-4 font-ui text-[15px] text-text-primary placeholder:text-text-tertiary transition-all duration-200 hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.12)]';

  return (
    <main className="min-h-screen bg-surface lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="bfam-hero relative hidden overflow-hidden px-14 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[34%] animate-sheen bg-white/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-16 select-none font-display text-[360px] leading-none text-white/[0.07] animate-drift-x"
        >
          BFAM
        </span>
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/3 h-[340px] w-[340px] rounded-[999px] border border-white/15"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 top-[38%] h-[220px] w-[220px] rounded-[999px] border border-white/10"
        />
        {/* A ball drifting across the pitch lines */}
        <motion.svg
          aria-hidden
          viewBox="0 0 40 40"
          className="pointer-events-none absolute right-24 top-24 h-[44px] w-[44px] text-white/70"
          animate={reduce ? undefined : { y: [0, -14, 0], rotate: [0, 180, 360] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        >
          <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M11 6c6 5 6 23 0 28M29 6c-6 5-6 23 0 28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </motion.svg>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="relative"
        >
          <p className="font-display text-[44px] leading-none tracking-wide">BFAM</p>
          <p className="mt-2 font-ui text-micro uppercase tracking-[0.26em] text-white/70">
            Brother from another mother
          </p>
        </motion.div>

        <div className="relative max-w-[480px]">
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
            className="font-display text-[84px] uppercase leading-[0.95] tracking-wide"
          >
            Run your
            <br />
            turf like
            <br />
            <span className="text-ink-black">a pro.</span>
          </motion.h1>
          <motion.span
            aria-hidden
            className="mt-6 block h-[5px] rounded-[2px] bg-white"
            initial={{ width: 0 }}
            animate={{ width: 72 }}
            transition={{ duration: 0.6, delay: 0.5, ease: EASE_OUT }}
          />
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.title}
                initial={reduce ? false : { opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + i * 0.12, ease: EASE_OUT }}
                className="flex items-start gap-4"
              >
                <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <f.icon className="h-[20px] w-[20px]" />
                </span>
                <span>
                  <span className="block font-ui text-[15px] font-bold">{f.title}</span>
                  <span className="block font-ui text-body text-white/75">{f.text}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative font-ui text-micro text-white/60">© BFAM · Turf management portal</p>
      </section>

      {/* Form panel */}
      <section className="bfam-canvas relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-[280px] w-[280px] rounded-[999px] bg-brand-red/[0.07]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-[300px] w-[300px] rounded-[999px] bg-ink-black/[0.04]"
        />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 26, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="relative w-full max-w-[440px] rounded-[18px] border border-border-subtle bg-surface/95 p-9 shadow-[0_30px_80px_rgba(0,0,0,0.10)] backdrop-blur"
        >
          <div className="mb-8">
            <h2 className="mb-5 flex">
              <img src="/logo-horizontal.png" alt="BFAM" className="h-[52px] w-auto" />
            </h2>
            <p className="font-display text-[34px] uppercase leading-none tracking-wide text-ink-black">
              Welcome back
            </p>
            <motion.span
              aria-hidden
              className="mt-3 block h-[4px] rounded-[2px] bg-brand-red"
              initial={{ width: 0 }}
              animate={{ width: 48 }}
              transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }}
            />
            <p className="mt-4 font-ui text-body text-text-secondary">
              Sign in to the Owner &amp; Staff Portal.
            </p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Accounts that can sign in here">
              {ROLES.map((r, i) => (
                <motion.span
                  key={r}
                  initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: 0.35 + i * 0.08, ease: EASE_OUT }}
                  className="rounded-[999px] bg-ink-black/[0.05] px-3 py-[5px] font-ui text-[12px] font-semibold text-text-secondary"
                >
                  {r}
                </motion.span>
              ))}
            </div>
          </div>

          <motion.form
            key={shakes}
            onSubmit={submit}
            noValidate
            animate={shakes > 0 && !reduce ? { x: [0, -10, 10, -7, 7, -3, 0] } : undefined}
            transition={{ duration: 0.45 }}
          >
            <label className="mb-5 block">
              <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
                Phone or email
              </span>
              <span className="relative mt-[6px] block">
                <Smartphone className="pointer-events-none absolute left-4 top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-text-tertiary transition-colors peer-focus:text-brand-red" />
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="9876543210"
                  autoComplete="username"
                  autoFocus
                  data-testid="login-identifier"
                  className={field}
                />
              </span>
            </label>

            <label className="mb-2 block">
              <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
                Password
              </span>
              <span className="relative mt-[6px] block">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-text-tertiary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                  onBlur={() => setCapsLock(false)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  data-testid="login-password"
                  className={`${field} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  data-testid="toggle-password"
                  className="absolute right-3 top-1/2 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-ink-black/[0.05] hover:text-brand-red cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-[19px] w-[19px]" />
                  ) : (
                    <Eye className="h-[19px] w-[19px]" />
                  )}
                </button>
              </span>
            </label>

            <div className="mb-4 min-h-[22px]">
              <AnimatePresence initial={false}>
                {capsLock && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1 font-ui text-[12px] font-semibold text-status-warning"
                    data-testid="caps-warning"
                  >
                    <TriangleAlert className="h-[14px] w-[14px]" /> Caps Lock is on
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence initial={false}>
              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden rounded-lg bg-status-danger-bg px-4 py-3 font-ui text-body text-status-danger"
                  data-testid="login-error"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={submitting || welcome}
              whileHover={reduce || submitting ? undefined : { y: -2 }}
              whileTap={reduce || submitting ? undefined : { scale: 0.97 }}
              data-testid="login-submit"
              className="group relative flex h-[54px] w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-brand-red font-ui text-[15px] font-bold uppercase tracking-wide text-white shadow-[0_10px_26px_rgba(216,0,0,0.32)] transition-[background-color,box-shadow] duration-200 hover:bg-[#e10600] hover:shadow-[0_14px_34px_rgba(216,0,0,0.4)] disabled:cursor-wait disabled:opacity-90"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-[35%] -translate-x-[120%] skew-x-[-18deg] bg-white/25 group-hover:animate-sheen"
              />
              {welcome ? (
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2"
                  data-testid="login-welcome"
                >
                  <Users className="h-[18px] w-[18px]" /> Welcome back
                </motion.span>
              ) : submitting ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </motion.button>
          </motion.form>

          <p className="mt-6 text-center font-ui text-[12px] text-text-tertiary">
            Having trouble? Ask your turf owner or BFAM admin to check your account.
          </p>
        </motion.div>
      </section>
    </main>
  );
}
