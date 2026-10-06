'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Megaphone,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Trophy,
  MapPin,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { HomeContentInput, HomeContentItem, HomeItemKind } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader } from '../../../components/DashboardShell';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../components/ui/Drawer';
import { EASE_OUT } from '../../../components/ui/motion';
import { Toggle } from '../../../components/ui/Toggle';
import { useToast } from '../../../components/ui/Toast';
import {
  Button,
  EmptyState,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

const KIND_META: Record<HomeItemKind, { label: string; icon: typeof Tag; tone: Tone }> = {
  OFFER: { label: 'Offer', icon: Tag, tone: 'brand' },
  TURF: { label: 'Turf', icon: MapPin, tone: 'info' },
  TOURNAMENT: { label: 'Tournament', icon: Trophy, tone: 'warning' },
  ANNOUNCEMENT: { label: 'Announcement', icon: Megaphone, tone: 'neutral' },
};

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[42px] font-ui text-body text-text-primary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

// Home content (AW-13, PRD Backlog E-7): what the app's Home screen features
// beyond the banners. Cards point at live records, so an expired offer or a
// suspended turf quietly drops off by itself.
export default function AdminHomeContentPage() {
  const toast = useToast();
  const [items, setItems] = useState<HomeContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HomeContentItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<HomeContentItem | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await apiClient.getAdminHomeContent()).results);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fail = (err: unknown, fallback: string) =>
    toast.error(err instanceof BFAMApiError ? err.message : fallback);

  async function setActive(item: HomeContentItem, next: boolean) {
    setItems((list) =>
      list.map((x) => (x.item_id === item.item_id ? { ...x, is_active: next } : x)),
    );
    try {
      await apiClient.updateHomeContentItem(item.item_id, { is_active: next });
    } catch (err) {
      setItems((list) =>
        list.map((x) => (x.item_id === item.item_id ? { ...x, is_active: item.is_active } : x)),
      );
      fail(err, 'Could not change that card.');
    }
  }

  // Swapping display_order with the neighbour keeps the list stable.
  async function move(index: number, delta: -1 | 1) {
    const other = items[index + delta];
    const item = items[index];
    if (!other || !item) return;
    const a = item.display_order === other.display_order ? index : item.display_order;
    const b = item.display_order === other.display_order ? index + delta : other.display_order;
    try {
      await Promise.all([
        apiClient.updateHomeContentItem(item.item_id, { display_order: b }),
        apiClient.updateHomeContentItem(other.item_id, { display_order: a }),
      ]);
      await load();
    } catch (err) {
      fail(err, 'Could not reorder.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiClient.deleteHomeContentItem(deleting.item_id);
      toast.success('Card removed');
      await load();
    } catch (err) {
      fail(err, 'Could not remove that card.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div data-testid="admin-home-content-page">
      <PageHeader
        title="Home content"
        subtitle="Featured offers, turfs, tournaments and announcements on the app's Home screen."
        action={
          <Button icon={Plus} onClick={() => setEditing('new')} testID="new-home-item">
            Add a card
          </Button>
        }
      />

      {loading ? (
        <SkeletonRows rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nothing featured yet"
          message="Pin an offer, a turf, a tournament or write an announcement."
          testID="home-empty"
          action={
            <Button icon={Plus} onClick={() => setEditing('new')}>
              Add a card
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3" data-testid="home-item-list">
          {items.map((item, index) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const broken = item.kind !== 'ANNOUNCEMENT' && !item.ref_label;
            return (
              <motion.li
                key={item.item_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: EASE_OUT }}
                data-testid={`home-item-${item.item_id}`}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4"
              >
                <span className="grid h-[40px] w-[40px] place-items-center rounded-md bg-brand-red/10 text-brand-red">
                  <Icon className="h-[20px] w-[20px]" />
                </span>
                <div className="min-w-[220px] flex-1">
                  <p className="font-ui text-card-title font-bold text-ink-black">
                    {item.kind === 'ANNOUNCEMENT'
                      ? item.title
                      : item.title || item.ref_label || 'Missing item'}
                  </p>
                  <p className="font-ui text-body text-text-tertiary">
                    {item.kind === 'ANNOUNCEMENT'
                      ? (item.body ?? '')
                      : item.ref_label
                        ? `${meta.label}: ${item.ref_label}`
                        : 'The record this pointed at is gone.'}
                  </p>
                </div>
                <StatusPill label={meta.label} tone={meta.tone} />
                {broken && <StatusPill label="Not showing" tone="danger" />}
                <Toggle
                  checked={item.is_active}
                  onChange={(v) => setActive(item, v)}
                  label={`${item.title ?? item.ref_label ?? 'Card'} shown`}
                  testID={`home-toggle-${item.item_id}`}
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={ArrowUp}
                    ariaLabel="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    testID={`up-${item.item_id}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={ArrowDown}
                    ariaLabel="Move down"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                    testID={`down-${item.item_id}`}
                  />
                  <Button
                    size="sm"
                    variant="soft"
                    icon={Pencil}
                    onClick={() => setEditing(item)}
                    testID={`edit-home-${item.item_id}`}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    ariaLabel="Remove"
                    onClick={() => setDeleting(item)}
                    testID={`delete-home-${item.item_id}`}
                  />
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a card' : 'Edit card'}
        testID="home-drawer"
      >
        {editing !== null && (
          <HomeItemForm
            item={editing === 'new' ? null : editing}
            onSaved={async () => {
              toast.success('Saved');
              setEditing(null);
              await load();
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title="Remove this card?"
        message="It disappears from Home. The offer, turf or tournament itself is not touched."
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        testID="home-delete-dialog"
      />
    </div>
  );
}

interface Choice {
  id: string;
  label: string;
}

function HomeItemForm({
  item,
  onSaved,
}: {
  item: HomeContentItem | null;
  onSaved: () => void | Promise<void>;
}) {
  const [kind, setKind] = useState<HomeItemKind>(item?.kind ?? 'OFFER');
  const [refId, setRefId] = useState(item?.ref_id ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [link, setLink] = useState(item?.link_url ?? '');
  const [from, setFrom] = useState(dateInput(item?.starts_at ?? null));
  const [until, setUntil] = useState(dateInput(item?.ends_at ?? null));
  const [choices, setChoices] = useState<Choice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (kind === 'ANNOUNCEMENT') return;
    let cancelled = false;
    const load = async (): Promise<Choice[]> => {
      if (kind === 'OFFER') {
        return (await apiClient.getPromoCodes()).results
          .filter((p) => p.is_active)
          .map((p) => ({ id: p.promo_code_id, label: p.code }));
      }
      if (kind === 'TURF') {
        return (await apiClient.getAllTurfsAdmin()).results
          .filter((t) => t.turf_status === 'ACTIVE')
          .map((t) => ({ id: t.turf_id, label: `${t.turf_name} · ${t.city}` }));
      }
      return (await apiClient.getTournaments()).results
        .filter((t) => t.status === 'REGISTRATION_OPEN' || t.status === 'IN_PROGRESS')
        .map((t) => ({ id: t.tournament_id, label: t.name }));
    };
    load()
      .then((list) => {
        if (cancelled) return;
        setChoices(list);
        setRefId((cur) =>
          list.some((c) => c.id === cur) ? cur : item?.kind === kind ? (item.ref_id ?? '') : '',
        );
      })
      .catch(() => !cancelled && setChoices([]));
    return () => {
      cancelled = true;
    };
  }, [kind, item]);

  async function submit() {
    if (kind === 'ANNOUNCEMENT' && !title.trim()) return setError('An announcement needs a title.');
    if (kind !== 'ANNOUNCEMENT' && !refId) return setError('Choose what to feature.');
    if (from && until && until < from)
      return setError('The end date must be after the start date.');
    setError(null);
    setSaving(true);
    const body_: Omit<HomeContentInput, 'kind'> = {
      ref_id: kind === 'ANNOUNCEMENT' ? null : refId,
      title: title.trim() || null,
      body: kind === 'ANNOUNCEMENT' ? body.trim() || null : null,
      link_url: kind === 'ANNOUNCEMENT' ? link.trim() || null : null,
      starts_at: from ? new Date(`${from}T00:00:00`).toISOString() : null,
      ends_at: until ? new Date(`${until}T23:59:59`).toISOString() : null,
    };
    try {
      if (item) await apiClient.updateHomeContentItem(item.item_id, body_);
      else await apiClient.createHomeContentItem({ kind, ...body_ });
      await onSaved();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the card.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="home-form"
    >
      {!item && (
        <div className="mb-4">
          <span className={LABEL}>What is it?</span>
          <div className="mt-1">
            <SegmentedControl<HomeItemKind>
              testIDPrefix="home-kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'OFFER', label: 'Offer' },
                { value: 'TURF', label: 'Turf' },
                { value: 'TOURNAMENT', label: 'Tournament' },
                { value: 'ANNOUNCEMENT', label: 'News' },
              ]}
            />
          </div>
        </div>
      )}

      {kind !== 'ANNOUNCEMENT' ? (
        <label className="mb-4 block">
          <span className={LABEL}>Feature</span>
          <select
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            data-testid="home-ref"
            className={FIELD}
          >
            <option value="">Choose…</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="mb-4 block">
        <span className={LABEL}>
          {kind === 'ANNOUNCEMENT' ? 'Title' : 'Custom title (optional)'}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          data-testid="home-title"
          className={FIELD}
        />
      </label>
      {kind === 'ANNOUNCEMENT' && (
        <>
          <label className="mb-4 block">
            <span className={LABEL}>Message (optional)</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={400}
              data-testid="home-body"
              className={`${FIELD} h-auto py-2`}
            />
          </label>
          <label className="mb-4 block">
            <span className={LABEL}>Link (optional)</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… or /tournaments"
              data-testid="home-link"
              className={FIELD}
            />
          </label>
        </>
      )}
      <div className="mb-5 grid grid-cols-2 gap-4">
        <label className="block">
          <span className={LABEL}>Show from</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="home-from"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Show until</span>
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            data-testid="home-until"
            className={FIELD}
          />
        </label>
      </div>
      {error && (
        <p
          role="alert"
          data-testid="home-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="home-submit">
        {item ? 'Save changes' : 'Add card'}
      </Button>
    </form>
  );
}
