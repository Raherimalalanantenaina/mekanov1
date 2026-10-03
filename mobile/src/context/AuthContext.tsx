import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  checkOnline,
  clearSession,
  fetchMe,
  getCachedUser,
  login as apiLogin,
  register as apiRegister,
} from '../api/client';
import type { AuthUser, Garage } from '../types';
import { resetAccountSync, syncNow, useSync } from '../sync';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  offline: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    garage?: Partial<Garage>
  ) => Promise<Garage | null>;
  logout: () => Promise<void>;
  refreshConnectivity: () => Promise<void>;
  /** Recharge le profil depuis l'API (statut de validation). */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const refreshConnectivity = useCallback(async () => {
    const online = await checkOnline();
    setOffline(!online);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser((prev) =>
        JSON.stringify(prev) === JSON.stringify(me) ? prev : me
      );
    } catch {
      /* hors ligne ou session expirée : on garde l'utilisateur en cache */
    }
  }, []);

  // Validation, suspension, offre… modifiées dans le back-office
  useSync(['account'], () => {
    if (user) refreshUser();
  });

  useEffect(() => {
    (async () => {
      const cached = await getCachedUser();
      setUser(cached);
      await refreshConnectivity();
      setLoading(false);
    })();

    const unsub = NetInfo.addEventListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsub();
  }, [refreshConnectivity]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      offline,
      refreshConnectivity,
      login: async (email, password) => {
        const data = await apiLogin(email, password);
        setUser(data.user);
        setOffline(false);
        resetAccountSync();
        syncNow();
      },
      register: async (email, password, fullName, garage) => {
        const data = await apiRegister(email, password, fullName, garage);
        setUser(data.user);
        setOffline(false);
        resetAccountSync();
        syncNow();
        return data.garage ?? null;
      },
      logout: async () => {
        await clearSession();
        setUser(null);
        resetAccountSync();
      },
      refreshUser,
    }),
    [user, loading, offline, refreshConnectivity, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
