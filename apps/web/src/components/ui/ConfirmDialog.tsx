'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './kit';

// A centered confirmation for destructive actions. Optionally collects a
// reason (cancelling a booking, for instance). ESC and the backdrop cancel.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep it',
  onConfirm,
  onCancel,
  busy = false,
  reasonLabel,
  testID,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  busy?: boolean;
  /** When set, shows a text box labelled this and passes its value to onConfirm. */
  reasonLabel?: string;
  testID?: string;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" data-testid={testID}>
          <motion.div
            className="absolute inset-0 bg-ink-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={busy ? undefined : onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-[440px] rounded-lg bg-surface p-6 shadow-[0_30px_80px_rgba(0,0,0,0.3)]"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          >
            <div className="flex items-start gap-4">
              <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[999px] bg-brand-red/10 text-brand-red">
                <AlertTriangle className="h-[22px] w-[22px]" />
              </span>
              <div>
                <h2 className="font-ui font-bold text-section-header text-ink-black">{title}</h2>
                <p className="font-ui text-body text-text-secondary mt-1">{message}</p>
              </div>
            </div>
            {reasonLabel ? (
              <label className="block mt-5">
                <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
                  {reasonLabel}
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  data-testid="confirm-reason"
                  className="mt-1 w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2 font-ui text-body focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]"
                />
              </label>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={onCancel} disabled={busy} testID="confirm-cancel">
                {cancelLabel}
              </Button>
              <Button loading={busy} onClick={() => onConfirm(reason.trim())} testID="confirm-ok">
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
