'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info } as const;
const ACCENT: Record<ToastKind, string> = {
  success: 'text-[#ff5a5a]',
  error: 'text-[#ff8a8a]',
  info: 'text-white/70',
};

// App-wide toasts for action feedback (checked in, cash recorded, a failure
// from the server...). Auto-dismiss after 4s; also dismissible by hand.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-32px)]"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = ICONS[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="flex items-start gap-3 rounded-lg bg-ink-black text-white px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.25)]"
                data-testid={`toast-${t.kind}`}
              >
                <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${ACCENT[t.kind]}`} />
                <p className="font-ui text-body flex-1 leading-snug">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-[16px] w-[16px]" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  // Pages rendered in isolation (tests) must not crash without a provider.
  return (
    ctx ?? {
      success: () => {},
      error: () => {},
      info: () => {},
    }
  );
}
