'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type {
  StaffActivityEntry,
  StaffAssignment,
  StaffPermissions,
  Turf,
} from '@bfam/shared-types';
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
import { Drawer } from '../../../components/ui/Drawer';
import { Toggle } from '../../../components/ui/Toggle';

const PERMISSIONS: { key: keyof StaffPermissions; label: string; hint: string }[] = [
  { key: 'check_in', label: 'Check players in', hint: 'Mark players present, late or no-show' },
  { key: 'collect_cash', label: 'Collect cash', hint: 'Record cash taken at the desk' },
  { key: 'score_matches', label: 'Score matches', hint: 'Run the live scoring console' },
  { key: 'close_turf', label: 'Close the turf for the day', hint: 'Stop new bookings for today' },
];

const ACTIVITY_LABEL: Record<string, string> = {
  STAFF_CHECK_IN: 'Checked a player in',
  STAFF_CASH_COLLECTED: 'Collected cash',
  STAFF_INNINGS_STARTED: 'Started an innings',
  STAFF_MATCH_FINISHED: 'Finished a match',
  TURF_CLOSED_TODAY: 'Closed the turf for the day',
  TURF_REOPENED_TODAY: 'Reopened the turf',
};

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
  const [activityFor, setActivityFor] = useState<StaffAssignment | null>(null);
  const [activity, setActivity] = useState<StaffActivityEntry[] | null>(null);

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

  // Owner decides which desk actions this staff member may do (all on by default).
  async function setPermission(s: StaffAssignment, key: keyof StaffPermissions, value: boolean) {
    setError(null);
    const previous = staff;
    setStaff((list) =>
      list.map((x) =>
        x.assignment_id === s.assignment_id
          ? { ...x, permissions: { ...x.permissions, [key]: value } }
          : x,
      ),
    );
    try {
      await apiClient.updateStaffPermissions(s.assignment_id, { [key]: value });
    } catch (err) {
      setStaff(previous);
      setError(err instanceof BFAMApiError ? err.message : 'Could not change that permission.');
    }
  }

  async function openActivity(s: StaffAssignment) {
    setActivityFor(s);
    setActivity(null);
    try {
      setActivity((await apiClient.getStaffActivity(s.assignment_id)).results);
    } catch {
      setActivity([]);
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
              {s.verification_status === 'APPROVED' && (
                <div
                  className="mt-4 border-t border-border-subtle pt-3"
                  data-testid={`permissions-${s.assignment_id}`}
                >
                  <p className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
                    What they can do
                  </p>
                  {PERMISSIONS.map((perm) => (
                    <div
                      key={perm.key}
                      className="flex items-center justify-between gap-3 py-[6px]"
                    >
                      <div>
                        <p className="font-ui text-body font-semibold text-ink-black">
                          {perm.label}
                        </p>
                        <p className="font-ui text-micro text-text-tertiary">{perm.hint}</p>
                      </div>
                      <Toggle
                        checked={s.permissions?.[perm.key] !== false}
                        onChange={(v) => setPermission(s, perm.key, v)}
                        label={`${perm.label} for ${s.phone_number ?? 'staff'}`}
                        testID={`perm-${perm.key}-${s.assignment_id}`}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <SecondaryButton onClick={() => openActivity(s)}>Activity</SecondaryButton>
                <SecondaryButton onClick={() => remove(s.assignment_id)}>Remove</SecondaryButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={activityFor !== null}
        onClose={() => setActivityFor(null)}
        title="Staff activity"
        subtitle={activityFor?.phone_number ?? undefined}
        width={460}
        testID="staff-activity-drawer"
      >
        {activity === null ? (
          <BallLoader />
        ) : activity.length === 0 ? (
          <p className="font-ui text-body text-text-tertiary" data-testid="activity-empty">
            Nothing recorded yet. Check-ins and cash they collect will show here.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="activity-list">
            {activity.map((a) => (
              <li key={a.log_id} className="rounded-md border border-border-subtle px-4 py-3">
                <p className="font-ui text-body font-semibold text-ink-black">
                  {ACTIVITY_LABEL[a.action] ?? a.action}
                  {a.action === 'STAFF_CASH_COLLECTED' && a.details?.amount != null
                    ? ` — ₹${Number(a.details.amount).toLocaleString('en-IN')}`
                    : ''}
                  {a.action === 'STAFF_CHECK_IN' && a.details?.status
                    ? ` — ${String(a.details.status).replace('_', ' ').toLowerCase()}`
                    : ''}
                </p>
                <p className="font-ui text-micro text-text-tertiary">
                  {new Date(a.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  );
}
