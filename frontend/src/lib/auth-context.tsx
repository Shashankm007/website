'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@/types';
import { api, setAccessToken } from './client-api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setSessionToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get<User>('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  // Bootstrap session: try to mint an access token from the refresh cookie.
  useEffect(() => {
    (async () => {
      const token = await api.refresh();
      if (token) await loadMe();
      setLoading(false);
    })();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ accessToken: string; user: User }>('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload: { email: string; password: string; name?: string }) => {
    await api.post('/auth/register', payload);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  // Used by the OAuth callback page which receives an access token in the URL fragment.
  const setSessionToken = useCallback(
    async (token: string) => {
      setAccessToken(token);
      await loadMe();
    },
    [loadMe],
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser: loadMe, setSessionToken }),
    [user, loading, login, register, logout, loadMe, setSessionToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
