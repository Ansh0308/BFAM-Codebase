'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  KeyRound,
  LogIn,
  Pencil,
  Plus,
  RefreshCw,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { AdminUserRow, CreateManagedUserInput } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { useAuth } from '../../../lib/auth';
import { timeAgo } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../components/ui/Drawer';
import { EASE_OUT } from '../../../components/ui/motion';
import { useToast } from '../../../components/ui/Toast';
import {
  Avatar,
  Button,
  EmptyState,
  SearchInput,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

type RoleFilter = 'ALL' | 'PLAYER' | 'TURF_OWNER' | 'TURF_STAFF' | 'ADMIN';

const ROLE_LABEL: Record<string, string> = {
  PLAYER: 'Player',
  TURF_OWNER: 'Turf owner',
  TURF_STAFF: 'Turf staff',
  ADMIN: 'Admin',
};
const ROLE_TONE: Record<string, Tone> = {
  PLAYER: 'neutral',
  TURF_OWNER: 'brand',
  TURF_STAFF: 'info',
  ADMIN: 'warning',
};
const STATUS_TONE: Record<string, Tone> = { ACTIVE: 'success', SUSPENDED: 'danger' };

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[42px] font-ui text-body text-text-primary transition-all hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

function displayName(u: AdminUserRow): string {
  return u.full_name || u.email || u.phone_number;
}

// Users (PRD §9.1 "user management"): every account on the platform. This is
// where Turf Owner, Turf Staff and Admin accounts are created — they can no
// longer sign up from the app — and where any account can be edited,
// suspended, given a new password or removed. "Manage as" opens an owner's or
// staff member's own portal as that user, which is how the admin edits turfs,
// pricing, availability, venues and rosters.
export default function AdminUsersPage() {
  const toast = useToast();
  const router = useRouter();
  const { user: me, startActingAs } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiClient.getAdminUsers();
      setUsers(res.results);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const by = (r: string) => users.filter((u) => u.role === r).length;
    return {
      ALL: users.length,
      PLAYER: by('PLAYER'),
      TURF_OWNER: by('TURF_OWNER'),
      TURF_STAFF: by('TURF_STAFF'),
      ADMIN: by('ADMIN'),
    };
  }, [users]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (role !== 'ALL' && u.role !== role) return false;
      if (!q) return true;
      return (
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        u.phone_number.includes(q) ||
        (u.bfam_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, role, query]);

  async function toggleSuspend(u: AdminUserRow) {
    const next = u.account_status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await apiClient.updateManagedUser(u.user_id, { account_status: next });
      toast.success(`${displayName(u)} is now ${next === 'ACTIVE' ? 'active' : 'suspended'}`);
      await load(true);
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not change that account.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiClient.deleteManagedUser(deleting.user_id);
      toast.success(`${displayName(deleting)} was deleted`);
      setDeleting(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not delete that account.');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  function manageAs(u: AdminUserRow) {
    if (u.role !== 'TURF_OWNER' && u.role !== 'TURF_STAFF') return;
    startActingAs({ user_id: u.user_id, role: u.role, label: displayName(u) });
    router.push(u.role === 'TURF_OWNER' ? '/owner' : '/staff');
  }

  return (
    <div data-testid="admin-users-page">
      <PageHeader
        title="Users"
        subtitle="Every account on BFAM. Owners, staff and admins are created here."
        action={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => load(true)}
              testID="users-refresh"
            >
              Refresh
            </Button>
            <Button icon={UserPlus} onClick={() => setCreating(true)} testID="new-user">
              New account
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <SegmentedControl<RoleFilter>
          testIDPrefix="user-role"
          value={role}
          onChange={setRole}
          options={[
            { value: 'ALL', label: 'All', count: counts.ALL },
            { value: 'PLAYER', label: 'Players', count: counts.PLAYER },
            { value: 'TURF_OWNER', label: 'Owners', count: counts.TURF_OWNER },
            { value: 'TURF_STAFF', label: 'Staff', count: counts.TURF_STAFF },
            { value: 'ADMIN', label: 'Admins', count: counts.ADMIN },
          ]}
        />
        <div className="min-w-[260px] flex-1 max-w-md">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Name, phone, email or BFAM ID"
            ariaLabel="Search users"
            testID="user-search"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No accounts here"
          message={users.length === 0 ? 'No accounts yet.' : 'No accounts match this view.'}
          testID="users-empty"
          action={
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New account
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3" data-testid="user-list">
          {visible.map((u, index) => {
            const isMe = u.user_id === me?.user_id;
            const canManage = u.role === 'TURF_OWNER' || u.role === 'TURF_STAFF';
            return (
              <motion.li
                key={u.user_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.03, ease: EASE_OUT }}
                data-testid={`user-${u.user_id}`}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.07)]"
              >
                <Avatar name={displayName(u)} size={42} />
                <div className="min-w-[200px] flex-1">
                  <p className="font-ui text-card-title font-bold text-ink-black">
                    {displayName(u)}
                    {isMe && (
                      <span className="ml-2 font-ui text-micro uppercase text-text-tertiary">
                        you
                      </span>
                    )}
                  </p>
                  <p className="font-ui text-body text-text-tertiary">
                    {u.phone_number}
                    {u.email ? ` · ${u.email}` : ''}
                    {u.bfam_id ? ` · ${u.bfam_id}` : ''}
                  </p>
                  <p className="font-ui text-micro text-text-tertiary mt-[2px]">
                    {u.last_login_at ? `Last seen ${timeAgo(u.last_login_at)}` : 'Never signed in'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill label={ROLE_LABEL[u.role] ?? u.role} tone={ROLE_TONE[u.role]} />
                  <StatusPill
                    label={u.account_status}
                    tone={STATUS_TONE[u.account_status] ?? 'neutral'}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canManage && (
                    <Button
                      size="sm"
                      icon={LogIn}
                      onClick={() => manageAs(u)}
                      testID={`manage-${u.user_id}`}
                    >
                      Manage as
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="soft"
                    icon={Pencil}
                    onClick={() => setEditing(u)}
                    ariaLabel={`Edit ${displayName(u)}`}
                    testID={`edit-${u.user_id}`}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="soft"
                    icon={KeyRound}
                    onClick={() => setPasswordFor(u)}
                    ariaLabel={`Reset password for ${displayName(u)}`}
                    testID={`password-${u.user_id}`}
                  >
                    Password
                  </Button>
                  {!isMe && (
                    <>
                      <Button
                        size="sm"
                        variant="soft"
                        icon={u.account_status === 'SUSPENDED' ? ShieldCheck : ShieldBan}
                        onClick={() => toggleSuspend(u)}
                        testID={`suspend-${u.user_id}`}
                      >
                        {u.account_status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => setDeleting(u)}
                        ariaLabel={`Delete ${displayName(u)}`}
                        testID={`delete-${u.user_id}`}
                      />
                    </>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title="New account"
        subtitle="Create a turf owner, turf staff or admin login."
        testID="user-create-drawer"
      >
        {creating && (
          <CreateUserForm
            onCreated={async (created) => {
              toast.success(`${ROLE_LABEL[created.role]} account created`);
              setCreating(false);
              await load(true);
            }}
          />
        )}
      </Drawer>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit account"
        subtitle={editing ? `${ROLE_LABEL[editing.role]} · ${displayName(editing)}` : undefined}
        testID="user-edit-drawer"
      >
        {editing && (
          <EditUserForm
            user={editing}
            onSaved={async () => {
              toast.success('Account updated');
              setEditing(null);
              await load(true);
            }}
          />
        )}
      </Drawer>

      <Drawer
        open={passwordFor !== null}
        onClose={() => setPasswordFor(null)}
        title="Reset password"
        subtitle={passwordFor ? displayName(passwordFor) : undefined}
        testID="user-password-drawer"
      >
        {passwordFor && (
          <PasswordForm
            user={passwordFor}
            onDone={() => {
              toast.success('Password updated');
              setPasswordFor(null);
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this account?"
        message={
          deleting
            ? `${displayName(deleting)} will no longer be able to sign in. Their bookings and match history are kept.`
            : ''
        }
        confirmLabel="Delete account"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        testID="user-delete-dialog"
      />
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: (user: AdminUserRow) => void }) {
  const [role, setRole] = useState<CreateManagedUserInput['role']>('TURF_OWNER');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!/^\+?\d{7,15}$/.test(phone.trim())) {
      setError('Enter a phone number of 7–15 digits.');
      return;
    }
    if (password.length < 8) {
      setError('The password must be at least 8 characters.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await apiClient.createManagedUser({
        role,
        phone_number: phone.trim(),
        password,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the account.');
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
      data-testid="user-create-form"
    >
      <div className="mb-4">
        <span className={LABEL}>Account type</span>
        <div className="mt-1">
          <SegmentedControl<CreateManagedUserInput['role']>
            testIDPrefix="create-role"
            value={role}
            onChange={setRole}
            options={[
              { value: 'TURF_OWNER', label: 'Turf owner' },
              { value: 'TURF_STAFF', label: 'Turf staff' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
          />
        </div>
      </div>
      <label className="mb-4 block">
        <span className={LABEL}>Phone number</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="9876543210"
          data-testid="create-phone"
          className={FIELD}
        />
      </label>
      <label className="mb-4 block">
        <span className={LABEL}>Email (optional)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="create-email"
          className={FIELD}
        />
      </label>
      <label className="mb-4 block">
        <span className={LABEL}>City (optional)</span>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          data-testid="create-city"
          className={FIELD}
        />
      </label>
      <label className="mb-5 block">
        <span className={LABEL}>Temporary password</span>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="off"
          data-testid="create-password"
          className={FIELD}
        />
        <span className="mt-1 block font-ui text-micro text-text-tertiary">
          Share it with them privately — they can sign in to the web portal or the app with it.
        </span>
      </label>
      {error && (
        <p
          role="alert"
          data-testid="user-form-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="create-submit">
        Create account
      </Button>
    </form>
  );
}

function EditUserForm({ user, onSaved }: { user: AdminUserRow; onSaved: () => void }) {
  const [phone, setPhone] = useState(user.phone_number);
  const [email, setEmail] = useState(user.email ?? '');
  const [city, setCity] = useState(user.city ?? '');
  const [name, setName] = useState(user.full_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!/^\+?\d{7,15}$/.test(phone.trim())) {
      setError('Enter a phone number of 7–15 digits.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiClient.updateManagedUser(user.user_id, {
        phone_number: phone.trim(),
        email: email.trim() || null,
        city: city.trim() || null,
        ...(user.role === 'PLAYER' ? { full_name: name.trim() || null } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the changes.');
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
      data-testid="user-edit-form"
    >
      {user.role === 'PLAYER' && (
        <label className="mb-4 block">
          <span className={LABEL}>Full name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="edit-name"
            className={FIELD}
          />
        </label>
      )}
      <label className="mb-4 block">
        <span className={LABEL}>Phone number</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          data-testid="edit-phone"
          className={FIELD}
        />
      </label>
      <label className="mb-4 block">
        <span className={LABEL}>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="edit-email"
          className={FIELD}
        />
      </label>
      <label className="mb-5 block">
        <span className={LABEL}>City</span>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          data-testid="edit-city"
          className={FIELD}
        />
      </label>
      {error && (
        <p
          role="alert"
          data-testid="user-form-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="edit-submit">
        Save changes
      </Button>
    </form>
  );
}

function PasswordForm({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (password.length < 8) {
      setError('The password must be at least 8 characters.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiClient.resetManagedUserPassword(user.user_id, password);
      onDone();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not reset the password.');
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
      data-testid="user-password-form"
    >
      <label className="mb-5 block">
        <span className={LABEL}>New password</span>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          placeholder="At least 8 characters"
          data-testid="reset-password"
          className={FIELD}
        />
      </label>
      {error && (
        <p
          role="alert"
          data-testid="user-form-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="reset-submit">
        Set new password
      </Button>
    </form>
  );
}
