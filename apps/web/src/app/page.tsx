'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

// Root route — sends the visitor straight to the right place: their
// dashboard if already signed in (module 2.12's Owner Web/Staff Web),
// otherwise /login.
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role === 'TURF_OWNER') {
      router.replace('/owner');
    } else if (user.role === 'TURF_STAFF') {
      router.replace('/staff');
    } else {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center">
      <p className="font-ui text-body text-text-secondary">Loading…</p>
    </main>
  );
}
