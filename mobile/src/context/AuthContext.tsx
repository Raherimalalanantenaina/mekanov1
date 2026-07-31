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
import type { AuthUser } from '../types';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  offline: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<void>;
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
      },
      register: async (email, password, fullName) => {
        const data = await apiRegister(email, password, fullName);
        setUser(data.user);
        setOffline(false);
      },
      logout: async () => {
        await clearSession();
        setUser(null);
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
