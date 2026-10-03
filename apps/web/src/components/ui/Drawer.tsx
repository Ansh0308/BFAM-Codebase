'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

// Right-hand slide-over panel for "open this row" detail views (a booking's
// desk, a match roster). ESC and the backdrop close it.
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 580,
  testID,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: number;
  testID?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid={testID}>
          <motion.div
            className="absolute inset-0 bg-ink-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative h-full bg-surface shadow-[-24px_0_60px_rgba(0,0,0,0.18)] flex flex-col"
            style={{ width: `min(${width}px, 100vw)` }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 36 }}
          >
            <div className="relative px-7 pt-6 pb-5 border-b border-border-subtle overflow-hidden">
              <div className="absolute -top-10 -right-10 h-[128px] w-[128px] rounded-[999px] bg-brand-red/10" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-ui font-bold text-section-header text-ink-black">{title}</h2>
                  {subtitle ? (
                    <p className="font-ui text-body text-text-tertiary mt-1">{subtitle}</p>
                  ) : null}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close panel"
                  className="h-[36px] w-[36px] grid place-items-center rounded-md border border-border-strong text-text-secondary hover:text-brand-red hover:border-brand-red transition-colors cursor-pointer"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-7 py-6">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
