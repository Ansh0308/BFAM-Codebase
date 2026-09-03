import { create } from 'zustand';
import { SelfServiceUserRole } from '@bfam/shared-types';

// Ephemeral, in-memory-only state carried across the multi-screen signup /
// social-signup flow (Signup -> OTP -> Role Selection -> Favorite Cricketer
// -> BFAM ID Confirmation). Intentionally NOT persisted (no SecureStore/
// AsyncStorage) — an interrupted signup should simply restart, and nothing
// here is a durable credential.
interface SignupState {
  // Phone/password branch
  identifier: string | null;
  password: string | null;
  signupToken: string | null;

  // Social branch (Google/Apple, new user)
  socialTicket: string | null;
  socialEmail: string | null;

  role: SelfServiceUserRole | null;
  favoriteCricketerName: string | null;
  favoriteCricketerExternalId: string | null;
  // Liability waiver consent (PRD §32.9) — collected once on Role
  // Selection, the one screen every self-service signup path passes
  // through, then carried to whichever screen actually calls
  // completeAccountCreation (Role Selection itself for Owner/Staff,
  // Favorite Cricketer for Player).
  waiverAccepted: boolean;

  setPhonePasswordSignup: (identifier: string, password: string) => void;
  setIdentifier: (identifier: string) => void;
  setSignupToken: (token: string) => void;
  setSocialTicket: (ticket: string, email: string | null) => void;
  setRole: (role: SelfServiceUserRole) => void;
  setFavoriteCricketer: (name: string | null, externalId: string | null) => void;
  setWaiverAccepted: (accepted: boolean) => void;
  reset: () => void;
}

const initialState = {
  identifier: null,
  password: null,
  signupToken: null,
  socialTicket: null,
  socialEmail: null,
  role: null,
  favoriteCricketerName: null,
  favoriteCricketerExternalId: null,
  waiverAccepted: false,
};

export const useSignupStore = create<SignupState>((set) => ({
  ...initialState,
  setPhonePasswordSignup: (identifier, password) => set({ identifier, password }),
  // Used by otp-verification.tsx, which never collects a password — must
  // NOT touch `password`, or it would clobber what signup.tsx already
  // stored with an empty string.
  setIdentifier: (identifier) => set({ identifier }),
  setSignupToken: (token) => set({ signupToken: token }),
  setSocialTicket: (ticket, email) => set({ socialTicket: ticket, socialEmail: email }),
  setRole: (role) => set({ role }),
  setFavoriteCricketer: (name, externalId) =>
    set({ favoriteCricketerName: name, favoriteCricketerExternalId: externalId }),
  setWaiverAccepted: (accepted) => set({ waiverAccepted: accepted }),
  reset: () => set(initialState),
}));
