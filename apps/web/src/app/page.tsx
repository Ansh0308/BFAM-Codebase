'use client';

import { motion } from 'motion/react';

// Placeholder landing for the BFAM Admin & Turf Management Portal — no
// module has been scoped for this app yet (all work so far has been the
// mobile app), so this stays a minimal branded placeholder rather than
// real admin functionality. Demonstrates `motion` wired up and working:
// a simple staggered fade/slide-in on load, same tokens (brand-red,
// display font) as the mobile app's AuthScreenBackground.
export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="text-center"
      >
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="font-display text-hero text-brand-red uppercase"
        >
          BFAM
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          className="font-ui text-body text-text-secondary mt-2"
        >
          Admin &amp; Turf Management Portal — coming soon.
        </motion.p>
      </motion.div>
    </main>
  );
}
