'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from './apiClient';

const TOKEN_KEY = 'bfam_web_token';
const USER_KEY = 'bfam_web_user';

export interface WebAuthUser {
  user_id: string;
  role: 'TURF_OWNER' | 'TURF_STAFF' | 'ADMIN' | 'PLAYER';
}

interface AuthContextValue {
  user: WebAuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<WebAuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Web equivalent of the mobile app's authStore (apps/mobile/src/store/
// authStore.ts) — same JWT, same /auth/login endpoint, persisted in
// localStorage (there's no SecureStore/Keychain on web) instead of
// expo-secure-store.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WebAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token && userJson) {
      apiClient.setToken(token);
      setUser(JSON.parse(userJson) as WebAuthUser);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await apiClient.login(identifier, password);
    const webUser: WebAuthUser = { user_id: res.user_id, role: res.role as WebAuthUser['role'] };
    apiClient.setToken(res.token);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(webUser));
    setUser(webUser);
    return webUser;
  }, []);

  const logout = useCallback(() => {
    apiClient.clearToken();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function dashboardPathFor(role: WebAuthUser['role']): string {
  if (role === 'TURF_OWNER') return '/owner';
  if (role === 'TURF_STAFF') return '/staff';
  if (role === 'ADMIN') return '/admin';
  return '/login';
}

// Redirects to /login if not authenticated, or to the correct dashboard if
// the logged-in role doesn't match this section (Owner Web vs Staff Web vs
// Admin Web — Admin is web-only, there's no mobile equivalent).
export function useRequireRole(role: 'TURF_OWNER' | 'TURF_STAFF' | 'ADMIN') {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== role) {
      router.replace(dashboardPathFor(user.role));
    }
  }, [loading, user, role, router]);

  return { user, loading };
}

export { BFAMApiError };
