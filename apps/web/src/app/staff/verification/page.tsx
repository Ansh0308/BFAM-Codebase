'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { StaffAssignment } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { BFAMApiError } from '../../../lib/auth';
import { PageHeader, Card, PrimaryButton } from '../../../components/DashboardShell';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected — resubmit below',
};

// Staff Verification, step 1 (module 2.12, PRD §32.14) — desk-based
// alternative to the mobile upload flow (apps/mobile/app/
// staff-verification.tsx), same endpoint.
export default function StaffVerificationPage() {
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTurfId = useRef<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getMyStaffAssignments()
      .then((res) => setAssignments(res.results))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function chooseFile(turfId: string) {
    pendingTurfId.current = turfId;
    fileInputRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const turfId = pendingTurfId.current;
    e.target.value = '';
    if (!file || !turfId) return;

    setUploadingFor(turfId);
    setError(null);
    try {
      await apiClient.submitStaffVerificationDocument(turfId, file);
      load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not upload your document.');
    } finally {
      setUploadingFor(null);
    }
  }

  return (
    <div data-testid="staff-verification-page">
      <PageHeader title="Verification" />
      {error && <p className="text-brand-red font-ui text-body mb-4">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={onFileSelected}
        className="hidden"
        data-testid="verification-file-input"
      />

      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : assignments.length === 0 ? (
        <p className="font-ui text-body text-text-tertiary" data-testid="staff-verification-empty">
          You are not yet assigned to a turf.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {assignments.map((a) => (
            <Card key={a.assignment_id} data-testid={`assignment-${a.assignment_id}`}>
              <p className="font-ui font-bold text-body text-text-primary">
                {a.turf_name ?? a.turf_id}
              </p>
              <p
                className={`font-ui text-micro uppercase mt-1 ${
                  a.verification_status === 'APPROVED' ? 'text-brand-red' : 'text-text-secondary'
                }`}
                data-testid={`status-${a.assignment_id}`}
              >
                {STATUS_LABEL[a.verification_status]}
              </p>
              {a.rejection_reason && (
                <p className="font-ui text-micro text-text-tertiary mt-1">{a.rejection_reason}</p>
              )}
              {a.verification_status !== 'APPROVED' && (
                <div className="mt-3">
                  <PrimaryButton
                    onClick={() => chooseFile(a.turf_id)}
                    disabled={uploadingFor === a.turf_id}
                  >
                    {a.verification_document_url ? 'Resubmit Document' : 'Upload Document'}
                  </PrimaryButton>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
