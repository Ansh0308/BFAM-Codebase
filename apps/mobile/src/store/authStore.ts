import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { User } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';

// JWT is a credential, not app preference data — persisted via
// expo-secure-store (Keychain/Keystore-backed), NOT AsyncStorage. There is
// no web implementation of SecureStore's native module (it's backed by
// Keychain/Keystore, which don't exist in a browser), so on web we no-op:
// the session simply doesn't survive a page reload there. This app's real
// target is native; web is a secondary/preview surface only.
const TOKEN_KEY = 'bfam_auth_token';
const USER_KEY = 'bfam_auth_user';
const isWeb = Platform.OS === 'web';

const secureStore = {
  async setItemAsync(key: string, value: string) {
    if (isWeb) return;
    await SecureStore.setItemAsync(key, value);
  },
  async getItemAsync(key: string) {
    if (isWeb) return null;
    return SecureStore.getItemAsync(key);
  },
  async deleteItemAsync(key: string) {
    if (isWeb) return;
    await SecureStore.deleteItemAsync(key);
  },
};

export interface AuthUser {
  user_id: string;
  // Only set for PLAYER accounts (PRD §12.59, updated) — null for
  // TURF_OWNER/TURF_STAFF/ADMIN.
  bfam_id: string | null;
  role: User['role'];
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True until hydrate() has resolved once at app launch. */
  isHydrating: boolean;
  setSession: (token: string, user: AuthUser) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isHydrating: true,

  setSession: async (token, user) => {
    apiClient.setToken(token);
    await secureStore.setItemAsync(TOKEN_KEY, token);
    await secureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  clearSession: async () => {
    apiClient.clearToken();
    await secureStore.deleteItemAsync(TOKEN_KEY);
    await secureStore.deleteItemAsync(USER_KEY);
    set({ token: null, user: null });
  },

  // Called once from app/_layout.tsx on launch. Restores a persisted
  // session (if any) so the router can skip Splash/Onboarding/Login and go
  // straight to the module hand-off point.
  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        secureStore.getItemAsync(TOKEN_KEY),
        secureStore.getItemAsync(USER_KEY),
      ]);
      if (token && userJson) {
        apiClient.setToken(token);
        set({ token, user: JSON.parse(userJson) as AuthUser, isHydrating: false });
        return;
      }
    } catch {
      // Corrupt/missing secure-store entry — fall through to a clean,
      // logged-out state rather than crashing app launch.
    }
    set({ token: null, user: null, isHydrating: false });
  },
}));
