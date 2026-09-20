import { create } from 'zustand';

// Backlog B-13: Team vs Team Challenge Mode. Set when a captain taps
// "Create Match" on an ACCEPTED challenge (team management screen), before
// navigating into Create Game (module 2.6) — carries both real team_ids
// and their names (Create Match's opponent search only has the id from a
// route param, and would otherwise need a follow-up fetch just to show the
// name). Ephemeral/in-memory only, same pattern as rebookStore: an
// interrupted handoff simply falls back to a normal Create Game with
// isTeamMatch off.
export interface ChallengeMatchPlan {
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
}

interface ChallengeMatchState {
  plan: ChallengeMatchPlan | null;
  setPlan: (plan: ChallengeMatchPlan) => void;
  clear: () => void;
}

export const useChallengeMatchStore = create<ChallengeMatchState>((set) => ({
  plan: null,
  setPlan: (plan) => set({ plan }),
  clear: () => set({ plan: null }),
}));
