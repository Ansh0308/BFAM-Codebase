'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /admin has nothing of its own yet — only the player directory this was
// built for — so it just forwards there.
export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/players');
  }, [router]);
  return null;
}
