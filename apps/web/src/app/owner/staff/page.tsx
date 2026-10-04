'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { StaffAssignment, Turf } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { BFAMApiError } from '../../../lib/auth';
import {
  PageHeader,
  Card,
  TextInput,
  PrimaryButton,
  SecondaryButton,
} from '../../../components/DashboardShell';
import { BallLoader } from '../../../components/BallLoader';

const STATUS_COLOR: Record<string, string> = {
  APPROVED: 'text-brand-red',
  PENDING: 'text-text-secondary',
  REJECTED: 'text-text-tertiary',
};

// Staff Management (module 2.12, PRD §8.3/§9.2), incl. Staff Verification
// review (PRD §32.14) — identical apiClient calls as the mobile equivalent
// (apps/mobile/app/owner-staff.tsx).
export default function OwnerStaffPage() {
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [turfId, setTurfId] = useState<string>('');
  const [staff, setStaff] = useState<StaffAssignment[]>([]);
  const [newStaffUserId, setNewStaffUserId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => {
        setTurfs(res.results);
        if (res.results.length > 0) setTurfId(res.results[0].turf_id);
      })
      .catch(() => setTurfs([]));
  }, []);

  const loadStaff = useCallback(() => {
    if (!turfId) return;
    setLoading(true);
    apiClient
      .listStaffForTurf(turfId)
      .then((res) => setStaff(res.results))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, [turfId]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  async function assign() {
    if (!turfId || !newStaffUserId.trim()) return;
    setError(null);
    try {
      await apiClient.assignStaff(turfId, newStaffUserId.trim());
      setNewStaffUserId('');
      loadStaff();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not assign staff.');
    }
  }

  // Staff cannot sign themselves up any more: the owner creates their login
  // here and shares the phone number + password with them.
  async function createAccount() {
    if (!turfId) return;
    setError(null);
    setCreated(null);
    if (!/^\+?\d{7,15}$/.test(newPhone.trim())) {
      setError('Enter the staff member’s phone number (7–15 digits).');
      return;
    }
    if (newPassword.length < 8) {
      setError('The password must be at least 8 characters.');
      return;
    }
    setCreating(true);
    try {
      await apiClient.createStaffAccount(turfId, {
        phone_number: newPhone.trim(),
        password: newPassword,
        verified: true,
      });
      setCreated(newPhone.trim());
      setNewPhone('');
      setNewPassword('');
      loadStaff();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the staff account.');
    } finally {
      setCreating(false);
    }
  }

  async function review(assignmentId: string, decision: 'APPROVED' | 'REJECTED') {
    setError(null);
    try {
      await apiClient.reviewStaffVerification(assignmentId, decision);
      loadStaff();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not review this staff member.');
    }
  }

  async function remove(assignmentId: string) {
    await apiClient.removeStaff(assignmentId);
    loadStaff();
  }

  return (
    <div data-testid="owner-staff-page">
      <PageHeader title="Staff Management" />
      {error && <p className="text-brand-red font-ui text-body mb-4">{error}</p>}

      {turfs.length > 0 && (
        <label className="block mb-6 max-w-xs">
          <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
            Turf
          </span>
          <select
            value={turfId}
            onChange={(e) => setTurfId(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 font-ui text-body"
          >
            {turfs.map((t) => (
              <option key={t.turf_id} value={t.turf_id}>
                {t.turf_name}
              </option>
            ))}
          </select>
        </label>
      )}

      <Card className="max-w-md mb-6" data-testid="create-staff-card">
        <p className="font-ui font-bold text-body text-text-primary mb-1">Create a staff account</p>
        <p className="font-ui text-micro text-text-tertiary mb-3">
          Gives a new staff member a login for this turf. Share the phone number and password with
          them.
        </p>
        <TextInput
          label="Staff phone number"
          value={newPhone}
          onChange={setNewPhone}
          placeholder="9876543210"
        />
        <TextInput
          label="Temporary password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="At least 8 characters"
        />
        <PrimaryButton onClick={createAccount} disabled={creating}>
          {creating ? 'Creating…' : 'Create Staff Account'}
        </PrimaryButton>
        {created && (
          <p
            className="font-ui text-body text-text-secondary mt-3"
            data-testid="create-staff-success"
          >
            Staff account created for {created}. They can sign in now.
          </p>
        )}
      </Card>

      <Card className="max-w-md mb-6">
        <TextInput
          label="Staff User ID"
          value={newStaffUserId}
          onChange={setNewStaffUserId}
          placeholder="Registered TURF_STAFF user ID"
        />
        <PrimaryButton onClick={assign}>Assign Staff</PrimaryButton>
      </Card>

      {loading ? (
        <BallLoader />
      ) : staff.length === 0 ? (
        <p className="font-ui text-body text-text-tertiary" data-testid="owner-staff-empty">
          No staff assigned to this turf yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {staff.map((s) => (
            <Card key={s.assignment_id} data-testid={`staff-row-${s.assignment_id}`}>
              <p className="font-ui font-bold text-body text-text-primary">
                {s.phone_number ?? s.staff_user_id}
              </p>
              <p
                className={`font-ui text-micro uppercase mt-1 ${STATUS_COLOR[s.verification_status]}`}
              >
                {s.verification_status}
              </p>
              {s.verification_status === 'PENDING' && s.verification_document_url && (
                <div className="flex gap-2 mt-3">
                  <PrimaryButton onClick={() => review(s.assignment_id, 'APPROVED')}>
                    Approve
                  </PrimaryButton>
                  <SecondaryButton onClick={() => review(s.assignment_id, 'REJECTED')}>
                    Reject
                  </SecondaryButton>
                </div>
              )}
              <div className="mt-3">
                <SecondaryButton onClick={() => remove(s.assignment_id)}>Remove</SecondaryButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
