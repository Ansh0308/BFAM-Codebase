'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminTurf } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { BFAMApiError, useAuth } from '../../../lib/auth';
import {
  DataTable,
  PageHeader,
  SecondaryButton,
  TextInput,
} from '../../../components/DashboardShell';
import { BallLoader } from '../../../components/BallLoader';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';

// Backlog E-3 — Turf Management in Admin Web (PRD §9.1): a cross-owner
// directory of every turf, plus moderation (suspend/reactivate). Owner
// Web already owns the fuller pricing/hours/blocks editing UI, scoped to
// "turfs I own" — this page is deliberately just the directory + status
// change, not a duplicate of that editor (see adminTurfService.ts for the
// full reasoning).
export default function AdminTurfsPage() {
  const [turfs, setTurfs] = useState<AdminTurf[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminTurf | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [rejecting, setRejecting] = useState<AdminTurf | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const router = useRouter();
  const { startActingAs } = useAuth();
  const toast = useToast();

  function load() {
    setLoading(true);
    apiClient
      .getAllTurfsAdmin()
      .then((res) => setTurfs(res.results))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function setStatus(turf: AdminTurf, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    setUpdatingId(turf.turf_id);
    try {
      await apiClient.setTurfStatusAdmin(turf.turf_id, status);
      load();
    } finally {
      setUpdatingId(null);
    }
  }

  // Turf approval (AW-11): a turf an owner creates stays hidden from players
  // until it is approved here; a rejection carries a reason the owner can read.
  async function approve(turf: AdminTurf) {
    setUpdatingId(turf.turf_id);
    try {
      await apiClient.approveTurfAdmin(turf.turf_id);
      toast.success(`${turf.turf_name} is now live`);
      load();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not approve that turf.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function reject(reason: string) {
    if (!rejecting) return;
    if (reason.length < 3) {
      toast.error('Give the owner a reason (at least 3 characters).');
      return;
    }
    setReviewBusy(true);
    try {
      await apiClient.rejectTurfAdmin(rejecting.turf_id, reason);
      toast.success(`${rejecting.turf_name} was rejected`);
      setRejecting(null);
      load();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not reject that turf.');
    } finally {
      setReviewBusy(false);
    }
  }

  const pending = turfs.filter((t) => t.turf_status === 'PENDING_APPROVAL');

  // Opens the owner's own portal as that owner — the full turf editor
  // (pricing, hours, availability, venues, staff) without a second copy of it.
  function manageAsOwner(turf: AdminTurf) {
    startActingAs({
      user_id: turf.owner_id,
      role: 'TURF_OWNER',
      label: turf.owner_name ?? turf.owner_phone,
    });
    router.push('/owner');
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiClient.deleteTurfAdmin(deleting.turf_id);
      toast.success(`${deleting.turf_name} was deleted`);
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not delete that turf.');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = query.trim()
    ? turfs.filter((t) => {
        const q = query.trim().toLowerCase();
        return (
          t.turf_name.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          (t.owner_name ?? '').toLowerCase().includes(q) ||
          t.owner_phone.includes(q)
        );
      })
    : turfs;

  return (
    <div data-testid="admin-turfs-page">
      <PageHeader title={`Turfs (${turfs.length})`} />

      {pending.length > 0 && (
        <p
          role="status"
          data-testid="pending-banner"
          className="mb-4 rounded-md bg-status-warning-bg px-4 py-3 font-ui text-body text-status-warning"
        >
          {pending.length} {pending.length === 1 ? 'turf is' : 'turfs are'} waiting for your
          approval.
        </p>
      )}

      <div className="max-w-sm mb-4">
        <TextInput
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Turf name, city, or owner"
        />
      </div>

      {loading ? (
        <BallLoader />
      ) : loadError ? (
        <p className="font-ui text-body text-brand-red">
          Could not load turfs. Your session may have expired — try logging in again.
        </p>
      ) : (
        <DataTable
          rows={filtered}
          keyField="turf_id"
          emptyMessage={
            turfs.length === 0 ? 'No turfs registered yet.' : 'No turfs match your search.'
          }
          columns={[
            { key: 'turf_name', label: 'Turf Name' },
            { key: 'city', label: 'City' },
            {
              key: 'owner_name',
              label: 'Owner',
              render: (r) => r.owner_name ?? r.owner_phone,
            },
            {
              key: 'turf_status',
              label: 'Status',
              render: (r) =>
                r.turf_status === 'PENDING_APPROVAL'
                  ? 'AWAITING APPROVAL'
                  : r.turf_status === 'REJECTED'
                    ? `REJECTED${r.rejection_reason ? ` — ${r.rejection_reason}` : ''}`
                    : r.turf_status,
            },
            {
              key: 'turf_id',
              label: 'Actions',
              render: (r) => (
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => manageAsOwner(r)}>
                    Manage as owner
                  </SecondaryButton>
                  {(r.turf_status === 'PENDING_APPROVAL' || r.turf_status === 'REJECTED') && (
                    <>
                      <SecondaryButton
                        onClick={() => approve(r)}
                        disabled={updatingId === r.turf_id}
                      >
                        Approve
                      </SecondaryButton>
                      {r.turf_status === 'PENDING_APPROVAL' && (
                        <SecondaryButton onClick={() => setRejecting(r)}>Reject</SecondaryButton>
                      )}
                    </>
                  )}
                  {r.turf_status !== 'SUSPENDED' &&
                    r.turf_status !== 'PENDING_APPROVAL' &&
                    r.turf_status !== 'REJECTED' && (
                      <SecondaryButton
                        onClick={() => setStatus(r, 'SUSPENDED')}
                        disabled={updatingId === r.turf_id}
                      >
                        Suspend
                      </SecondaryButton>
                    )}
                  {r.turf_status !== 'ACTIVE' &&
                    r.turf_status !== 'PENDING_APPROVAL' &&
                    r.turf_status !== 'REJECTED' && (
                      <SecondaryButton
                        onClick={() => setStatus(r, 'ACTIVE')}
                        disabled={updatingId === r.turf_id}
                      >
                        Reactivate
                      </SecondaryButton>
                    )}
                  <SecondaryButton onClick={() => setDeleting(r)}>Delete</SecondaryButton>
                </div>
              ),
            },
          ]}
        />
      )}

      <ConfirmDialog
        open={rejecting !== null}
        title="Reject this turf?"
        message={
          rejecting
            ? `${rejecting.turf_name} stays hidden from players. The owner sees your reason and can fix it.`
            : ''
        }
        confirmLabel="Reject turf"
        reasonLabel="Reason for the owner"
        busy={reviewBusy}
        onConfirm={reject}
        onCancel={() => setRejecting(null)}
        testID="reject-dialog"
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this turf?"
        message={
          deleting
            ? `${deleting.turf_name} will disappear from the app. A turf with upcoming bookings can’t be deleted.`
            : ''
        }
        confirmLabel="Delete turf"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
