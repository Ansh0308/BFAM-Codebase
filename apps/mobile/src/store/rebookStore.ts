import { create } from 'zustand';
import type { RebookInfo } from '@bfam/shared-types';

// Rebook Same Players (module 2.10, PRD §12.44). Set when the organizer
// taps "Rebook Same Players" on a completed Match Result screen, before
// navigating into the normal turf-availability -> booking -> payment flow
// (module 2.3) for the same turf. Create Game (module 2.6) reads this to
// prefill the match format, and re-invites the roster after the new match
// is created — then clears it. Ephemeral/in-memory only: an interrupted
// rebook simply falls back to a normal Create Game with no prefill.
interface RebookState {
  plan: RebookInfo | null;
  setPlan: (plan: RebookInfo) => void;
  clear: () => void;
}

export const useRebookStore = create<RebookState>((set) => ({
  plan: null,
  setPlan: (plan) => set({ plan }),
  clear: () => set({ plan: null }),
}));
