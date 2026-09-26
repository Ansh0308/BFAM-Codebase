'use client';

import React, { useEffect, useState } from 'react';
import type { AdminReview } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import {
  DataTable,
  PageHeader,
  SecondaryButton,
  TextInput,
} from '../../../components/DashboardShell';
import { BallLoader } from '../../../components/BallLoader';

// Backlog E-5 — Reviews Management in Admin Web (PRD §9.1): a full
// cross-turf/cross-player review directory, plus removal for moderation
// (abusive text, fraudulent ratings) — see adminReviewService.ts for why
// removal is a hard delete rather than a soft one.
export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiClient
      .getAllReviewsAdmin()
      .then((res) => setReviews(res.results))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function remove(review: AdminReview) {
    if (!window.confirm('Delete this review? This cannot be undone.')) return;
    setDeletingId(review.review_id);
    try {
      await apiClient.deleteReviewAdmin(review.review_id);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = query.trim()
    ? reviews.filter((r) => {
        const q = query.trim().toLowerCase();
        return (
          r.turf_name.toLowerCase().includes(q) ||
          (r.player_name ?? '').toLowerCase().includes(q) ||
          (r.review_text ?? '').toLowerCase().includes(q)
        );
      })
    : reviews;

  return (
    <div data-testid="admin-reviews-page">
      <PageHeader title={`Reviews (${reviews.length})`} />

      <div className="max-w-sm mb-4">
        <TextInput
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Turf, player, or review text"
        />
      </div>

      {loading ? (
        <BallLoader />
      ) : loadError ? (
        <p className="font-ui text-body text-brand-red">
          Could not load reviews. Your session may have expired — try logging in again.
        </p>
      ) : (
        <DataTable
          rows={filtered}
          keyField="review_id"
          emptyMessage={reviews.length === 0 ? 'No reviews yet.' : 'No reviews match your search.'}
          columns={[
            { key: 'turf_name', label: 'Turf' },
            {
              key: 'player_name',
              label: 'Player',
              render: (r) => r.player_name ?? '—',
            },
            { key: 'rating', label: 'Rating', render: (r) => `${r.rating} ★` },
            {
              key: 'review_text',
              label: 'Review',
              render: (r) => r.review_text ?? '—',
            },
            {
              key: 'created_at',
              label: 'Posted',
              render: (r) => new Date(r.created_at).toLocaleDateString(),
            },
            {
              key: 'review_id',
              label: 'Actions',
              render: (r) => (
                <SecondaryButton onClick={() => remove(r)} disabled={deletingId === r.review_id}>
                  Delete
                </SecondaryButton>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
