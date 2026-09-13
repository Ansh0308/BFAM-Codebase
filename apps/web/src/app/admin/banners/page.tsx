'use client';

import React, { useEffect, useState } from 'react';
import type { HomeBanner } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { BFAMApiError } from '../../../lib/auth';
import {
  Card,
  DataTable,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from '../../../components/DashboardShell';

// Admin CMS for the Home page carousel (backlog B-6) — create banners and
// toggle/delete them. Scheduling (starts_at/ends_at) is supported by the
// API but left out of this first cut of the form; every banner created
// here is either always-on or off via the Active toggle, which covers the
// feedback's actual ask ("let us display ads in the interface").
export default function AdminBannersPage() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiClient
      .getAllBanners()
      .then((res) => setBanners(res.results))
      .catch(() => setBanners([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) {
      setError('Title and image URL are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.createBanner({
        title: title.trim(),
        image_url: imageUrl.trim(),
        link_url: linkUrl.trim() || null,
        display_order: Number(displayOrder) || 0,
      });
      setTitle('');
      setImageUrl('');
      setLinkUrl('');
      setDisplayOrder('0');
      load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the banner.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(banner: HomeBanner) {
    await apiClient.updateBanner(banner.banner_id, { is_active: !banner.is_active });
    load();
  }

  async function remove(banner: HomeBanner) {
    if (!window.confirm(`Delete "${banner.title}"? This can't be undone.`)) return;
    await apiClient.deleteBanner(banner.banner_id);
    load();
  }

  return (
    <div data-testid="admin-banners-page">
      <PageHeader title="Home Banners" />

      <Card className="mb-8 max-w-xl">
        <form onSubmit={submit}>
          <TextInput label="Title" value={title} onChange={setTitle} placeholder="Summer Offer" />
          <TextInput
            label="Image URL"
            value={imageUrl}
            onChange={setImageUrl}
            placeholder="https://…"
          />
          <TextInput
            label="Link URL (optional)"
            value={linkUrl}
            onChange={setLinkUrl}
            placeholder="https://…"
          />
          <TextInput
            label="Display Order"
            value={displayOrder}
            onChange={setDisplayOrder}
            type="number"
          />
          {error && <p className="font-ui text-body text-brand-red-dark mb-4">{error}</p>}
          <PrimaryButton type="submit" disabled={submitting}>
            Create Banner
          </PrimaryButton>
        </form>
      </Card>

      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : (
        <DataTable
          rows={banners}
          keyField="banner_id"
          emptyMessage="No banners yet — create one above."
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'display_order', label: 'Order' },
            {
              key: 'is_active',
              label: 'Status',
              render: (r) => (r.is_active ? 'Active' : 'Inactive'),
            },
            {
              key: 'banner_id',
              label: 'Actions',
              render: (r) => (
                <div className="flex gap-2">
                  <SecondaryButton onClick={() => toggleActive(r)}>
                    {r.is_active ? 'Deactivate' : 'Activate'}
                  </SecondaryButton>
                  <SecondaryButton onClick={() => remove(r)}>Delete</SecondaryButton>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
