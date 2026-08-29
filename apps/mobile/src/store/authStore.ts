import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

interface AuthState {
  token: string | null;
  userId: string | null;
  role: string | null;
  isBootstrapping: boolean;
  // TEMPORARY: modules 2.1 (Auth) and 2.2 (Player Profile) have not been
  // built yet, so there is no real login screen to obtain a token from.
  // This calls the backend's existing POST /auth/dev-token endpoint
  // (Phase 1) so module 2.3's screens are reachable and testable now.
  // Replace this with the real 2.1 login flow when it's built — nothing in
  // 2.3 should come to depend on `bootstrapDevAuth` remaining around.
  bootstrapDevAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  role: null,
  isBootstrapping: false,
  bootstrapDevAuth: async () => {
    set({ isBootstrapping: true });
    try {
      const response = await fetch(`${API_URL}/auth/dev-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'PLAYER' }),
      });
      const body = await response.json();
      apiClient.setToken(body.token);
      set({ token: body.token, isBootstrapping: false });
    } catch {
      set({ isBootstrapping: false });
    }
  },
}));
