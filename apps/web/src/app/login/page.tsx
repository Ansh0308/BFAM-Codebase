'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, BFAMApiError } from '../../lib/auth';
import { TextInput, PrimaryButton } from '../../components/DashboardShell';

// Owner Web / Staff Web / Admin Web login — same POST /auth/login endpoint
// the mobile app uses (module 2.12 requirement 6; Admin is web-only, no
// mobile equivalent). Routes by role after success: TURF_OWNER -> /owner,
// TURF_STAFF -> /staff, ADMIN -> /admin.
export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(identifier, password);
      if (user.role === 'TURF_OWNER') router.replace('/owner');
      else if (user.role === 'TURF_STAFF') router.replace('/staff');
      else if (user.role === 'ADMIN') router.replace('/admin');
      else setError('This portal is for Turf Owner, Turf Staff, and Admin accounts only.');
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="flex justify-center mb-1">
          <img src="/logo-horizontal.png" alt="BFAM" className="h-14 w-auto" />
        </h1>
        <p className="font-ui text-body text-text-secondary text-center mb-8">
          Owner &amp; Staff Portal
        </p>

        <TextInput
          label="Phone or Email"
          value={identifier}
          onChange={setIdentifier}
          placeholder="9876543210"
        />
        <TextInput label="Password" value={password} onChange={setPassword} type="password" />

        {error && <p className="text-brand-red font-ui text-body mb-4">{error}</p>}

        <div className="mt-2">
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </PrimaryButton>
        </div>
      </form>
    </main>
  );
}
