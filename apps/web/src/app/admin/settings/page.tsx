'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Coins, LifeBuoy, ReceiptText, Wrench } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { PlatformSettings } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader } from '../../../components/DashboardShell';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { EASE_OUT } from '../../../components/ui/motion';
import { Toggle } from '../../../components/ui/Toggle';
import { useToast } from '../../../components/ui/Toast';
import { Button, SkeletonRows, StatusPill } from '../../../components/ui/kit';

type Key = keyof PlatformSettings;

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[42px] font-ui text-body text-text-primary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';
const HINT = 'mt-1 block font-ui text-micro text-text-tertiary';

// Platform settings (AW-12, PRD §9.1): the values that used to need a code
// release. Each card saves on its own. Anything left at its default behaves
// exactly as the app always has.
export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [defaults, setDefaults] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.getAdminSettings();
      setSettings(res.settings);
      setDefaults(res.defaults);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not load the settings.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!settings || !defaults) {
    return (
      <div data-testid="admin-settings-page">
        <PageHeader title="Settings" subtitle="Rules and values for the whole platform." />
        {error ? (
          <p role="alert" data-testid="settings-error" className="font-ui text-body text-brand-red">
            {error}
          </p>
        ) : (
          <SkeletonRows rows={4} />
        )}
      </div>
    );
  }

  return (
    <div data-testid="admin-settings-page">
      <PageHeader
        title="Settings"
        subtitle="Rules and values for the whole platform. Changes apply straight away."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <MaintenanceCard settings={settings} onSaved={setSettings} />
        <RefundsCard settings={settings} defaults={defaults} onSaved={setSettings} />
        <CoinsCard settings={settings} defaults={defaults} onSaved={setSettings} />
        <SupportCard settings={settings} onSaved={setSettings} />
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  subtitle,
  testID,
  children,
  badge,
}: {
  icon: typeof Wrench;
  title: string;
  subtitle: string;
  testID: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="rounded-lg border border-border-subtle bg-surface p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
      data-testid={testID}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-md bg-brand-red/10 text-brand-red">
            <Icon className="h-[20px] w-[20px]" />
          </span>
          <div>
            <h2 className="font-ui text-card-title font-bold text-ink-black">{title}</h2>
            <p className="font-ui text-body text-text-tertiary">{subtitle}</p>
          </div>
        </div>
        {badge}
      </div>
      {children}
    </motion.section>
  );
}

// Each card edits a few keys as strings and sends only what changed.
function useCard(settings: PlatformSettings, keys: Key[], onSaved: (s: PlatformSettings) => void) {
  const toast = useToast();
  const initial = () =>
    Object.fromEntries(keys.map((k) => [k, settings[k] === null ? '' : String(settings[k])]));
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(initial());
  }, [settings]);

  const dirty = keys.some((k) => draft[k] !== (settings[k] === null ? '' : String(settings[k])));

  async function save(
    convert: (key: Key, raw: string) => unknown,
    extra: Partial<PlatformSettings> = {},
  ) {
    const patch: Record<string, unknown> = { ...extra };
    for (const k of keys) {
      const was = settings[k] === null ? '' : String(settings[k]);
      if (draft[k] !== was) patch[k] = convert(k, draft[k]);
    }
    if (Object.keys(patch).length === 0) return;
    setError(null);
    setSaving(true);
    try {
      const res = await apiClient.updateAdminSettings(patch as Partial<PlatformSettings>);
      onSaved(res.settings);
      toast.success('Settings saved');
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the settings.');
    } finally {
      setSaving(false);
    }
  }
  return { draft, setDraft, error, saving, dirty, save };
}

const num = (_k: Key, raw: string) => Number(raw);

function RefundsCard({
  settings,
  defaults,
  onSaved,
}: {
  settings: PlatformSettings;
  defaults: PlatformSettings;
  onSaved: (s: PlatformSettings) => void;
}) {
  const keys: Key[] = [
    'booking.refund_full_hours',
    'booking.refund_partial_hours',
    'booking.refund_partial_percent',
    'booking.max_advance_days',
  ];
  const card = useCard(settings, keys, onSaved);
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) =>
    card.setDraft((d) => ({ ...d, [k]: e.target.value }));
  return (
    <Card
      icon={ReceiptText}
      title="Bookings & refunds"
      subtitle="When a cancellation earns a refund, and how far ahead players can book."
      testID="card-refunds"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          card.save((k, raw) =>
            k === 'booking.max_advance_days' && raw === '' ? null : Number(raw),
          );
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={LABEL}>Full refund if cancelled</span>
            <input
              type="number"
              min="1"
              value={card.draft['booking.refund_full_hours']}
              onChange={set('booking.refund_full_hours')}
              data-testid="set-full-hours"
              className={FIELD}
            />
            <span className={HINT}>
              hours or more before the slot (default {defaults['booking.refund_full_hours']})
            </span>
          </label>
          <label className="block">
            <span className={LABEL}>Partial refund from</span>
            <input
              type="number"
              min="0"
              value={card.draft['booking.refund_partial_hours']}
              onChange={set('booking.refund_partial_hours')}
              data-testid="set-partial-hours"
              className={FIELD}
            />
            <span className={HINT}>
              hours before (default {defaults['booking.refund_partial_hours']})
            </span>
          </label>
          <label className="block">
            <span className={LABEL}>Partial refund is</span>
            <input
              type="number"
              min="0"
              max="100"
              value={card.draft['booking.refund_partial_percent']}
              onChange={set('booking.refund_partial_percent')}
              data-testid="set-partial-percent"
              className={FIELD}
            />
            <span className={HINT}>
              % of the amount (default {defaults['booking.refund_partial_percent']})
            </span>
          </label>
          <label className="block">
            <span className={LABEL}>Book up to</span>
            <input
              type="number"
              min="1"
              value={card.draft['booking.max_advance_days']}
              onChange={set('booking.max_advance_days')}
              placeholder="No limit"
              data-testid="set-advance-days"
              className={FIELD}
            />
            <span className={HINT}>days ahead (empty = no limit)</span>
          </label>
        </div>
        <p className="mt-3 font-ui text-micro text-text-tertiary" data-testid="refund-summary">
          Cancel {card.draft['booking.refund_full_hours'] || '–'}h+ ahead: full refund ·{' '}
          {card.draft['booking.refund_partial_hours'] || '–'}–
          {card.draft['booking.refund_full_hours'] || '–'}h:{' '}
          {card.draft['booking.refund_partial_percent'] || '–'}% · less than{' '}
          {card.draft['booking.refund_partial_hours'] || '–'}h: none.
        </p>
        <SaveRow card={card} testID="save-refunds" />
      </form>
    </Card>
  );
}

function CoinsCard({
  settings,
  defaults,
  onSaved,
}: {
  settings: PlatformSettings;
  defaults: PlatformSettings;
  onSaved: (s: PlatformSettings) => void;
}) {
  const keys: Key[] = ['coins.value_in_rupees', 'coins.review_reward', 'coins.referral_reward'];
  const card = useCard(settings, keys, onSaved);
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) =>
    card.setDraft((d) => ({ ...d, [k]: e.target.value }));
  return (
    <Card
      icon={Coins}
      title="Coins & referrals"
      subtitle="What a BFAM Coin is worth and what players earn."
      testID="card-coins"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          card.save(num);
        }}
      >
        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <span className={LABEL}>1 coin is worth</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={card.draft['coins.value_in_rupees']}
              onChange={set('coins.value_in_rupees')}
              data-testid="set-coin-value"
              className={FIELD}
            />
            <span className={HINT}>
              ₹ off a booking (default {defaults['coins.value_in_rupees']})
            </span>
          </label>
          <label className="block">
            <span className={LABEL}>Review reward</span>
            <input
              type="number"
              min="0"
              value={card.draft['coins.review_reward']}
              onChange={set('coins.review_reward')}
              data-testid="set-review-reward"
              className={FIELD}
            />
            <span className={HINT}>coins (default {defaults['coins.review_reward']})</span>
          </label>
          <label className="block">
            <span className={LABEL}>Referral reward</span>
            <input
              type="number"
              min="0"
              value={card.draft['coins.referral_reward']}
              onChange={set('coins.referral_reward')}
              data-testid="set-referral-reward"
              className={FIELD}
            />
            <span className={HINT}>coins (default {defaults['coins.referral_reward']})</span>
          </label>
        </div>
        <SaveRow card={card} testID="save-coins" />
      </form>
    </Card>
  );
}

function SupportCard({
  settings,
  onSaved,
}: {
  settings: PlatformSettings;
  onSaved: (s: PlatformSettings) => void;
}) {
  const keys: Key[] = ['support.phone', 'support.email', 'legal.terms_url', 'legal.privacy_url'];
  const card = useCard(settings, keys, onSaved);
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) =>
    card.setDraft((d) => ({ ...d, [k]: e.target.value }));
  return (
    <Card
      icon={LifeBuoy}
      title="Support & legal links"
      subtitle="Shown to players in the app."
      testID="card-support"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          card.save((_k, raw) => raw.trim());
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={LABEL}>Support phone</span>
            <input
              value={card.draft['support.phone']}
              onChange={set('support.phone')}
              placeholder="+91 …"
              data-testid="set-support-phone"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Support email</span>
            <input
              type="email"
              value={card.draft['support.email']}
              onChange={set('support.email')}
              placeholder="help@…"
              data-testid="set-support-email"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Terms link</span>
            <input
              value={card.draft['legal.terms_url']}
              onChange={set('legal.terms_url')}
              placeholder="https://…"
              data-testid="set-terms"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Privacy link</span>
            <input
              value={card.draft['legal.privacy_url']}
              onChange={set('legal.privacy_url')}
              placeholder="https://…"
              data-testid="set-privacy"
              className={FIELD}
            />
          </label>
        </div>
        <SaveRow card={card} testID="save-support" />
      </form>
    </Card>
  );
}

function MaintenanceCard({
  settings,
  onSaved,
}: {
  settings: PlatformSettings;
  onSaved: (s: PlatformSettings) => void;
}) {
  const toast = useToast();
  const keys: Key[] = ['app.min_version', 'app.maintenance_message'];
  const card = useCard(settings, keys, onSaved);
  const on = settings['app.maintenance_enabled'];
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function flip(next: boolean) {
    setBusy(true);
    try {
      const res = await apiClient.updateAdminSettings({ 'app.maintenance_enabled': next });
      onSaved(res.settings);
      toast.success(next ? 'Maintenance mode is ON' : 'Bookings are open again');
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not change maintenance mode.');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <Card
      icon={Wrench}
      title="App control"
      subtitle="Pause bookings during an incident, or make old app versions update."
      testID="card-maintenance"
      badge={
        on ? (
          <StatusPill label="Maintenance on" tone="danger" pulse />
        ) : (
          <StatusPill label="Live" tone="success" />
        )
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-md bg-ink-black/[0.04] px-4 py-3">
        <div>
          <p className="font-ui text-body font-semibold text-ink-black">Maintenance mode</p>
          <p className="font-ui text-micro text-text-tertiary">
            New bookings and online payments are refused; existing ones keep working.
          </p>
        </div>
        <Toggle
          checked={on}
          onChange={(v) => (v ? setConfirm(true) : flip(false))}
          disabled={busy}
          label="Maintenance mode"
          testID="set-maintenance"
        />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          card.save((_k, raw) => raw.trim());
        }}
      >
        <label className="mb-4 block">
          <span className={LABEL}>Message players see</span>
          <input
            value={card.draft['app.maintenance_message']}
            onChange={(e) =>
              card.setDraft((d) => ({ ...d, 'app.maintenance_message': e.target.value }))
            }
            placeholder="We’ll be back in 30 minutes."
            data-testid="set-maint-message"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Minimum app version</span>
          <input
            value={card.draft['app.min_version']}
            onChange={(e) => card.setDraft((d) => ({ ...d, 'app.min_version': e.target.value }))}
            placeholder="e.g. 1.4.0 (empty = any)"
            data-testid="set-min-version"
            className={FIELD}
          />
          <span className={HINT}>Apps older than this ask the player to update.</span>
        </label>
        <SaveRow card={card} testID="save-maintenance" />
      </form>
      <ConfirmDialog
        open={confirm}
        title="Turn on maintenance mode?"
        message="Players can't make new bookings or online payments until you turn it off."
        confirmLabel="Turn on"
        busy={busy}
        onConfirm={() => flip(true)}
        onCancel={() => setConfirm(false)}
        testID="maintenance-dialog"
      />
    </Card>
  );
}

function SaveRow({ card, testID }: { card: ReturnType<typeof useCard>; testID: string }) {
  return (
    <div className="mt-5">
      {card.error && (
        <p
          role="alert"
          data-testid="card-error"
          className="mb-3 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {card.error}
        </p>
      )}
      <Button type="submit" loading={card.saving} disabled={!card.dirty} testID={testID}>
        Save changes
      </Button>
    </div>
  );
}
