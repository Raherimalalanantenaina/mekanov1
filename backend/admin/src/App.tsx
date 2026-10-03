import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import { useI18n, type TKey } from './i18n';
import type { Category, Stats } from './types';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Catalog } from './pages/Catalog';
import { Garages } from './pages/Garages';
import { Accounts } from './pages/Accounts';
import { Config } from './pages/Config';
import { GarageForm } from './pages/GarageForm';
import { Moderation } from './pages/Moderation';
import { Push } from './pages/Push';
import { Plans } from './pages/Plans';

type CatalogValue = {
  catalog: Category[];
  setCatalog: (c: Category[]) => void;
  reloadCatalog: () => Promise<void>;
};

const CatalogContext = createContext<CatalogValue>({
  catalog: [],
  setCatalog: () => {},
  reloadCatalog: async () => {},
});

export function useCatalog() {
  return useContext(CatalogContext);
}

/** Rafraîchit les compteurs « en attente » du menu après une action. */
const CountsContext = createContext<() => void>(() => {});
export function useRefreshCounts() {
  return useContext(CountsContext);
}

const PAGES: { path: string; label: TKey; component: React.ComponentType }[] = [
  { path: 'dashboard', label: 'navDashboard', component: Dashboard },
  { path: 'catalog', label: 'navCatalog', component: Catalog },
  { path: 'garages', label: 'navGarages', component: Garages },
  { path: 'accounts', label: 'navAccounts', component: Accounts },
  { path: 'config', label: 'navConfig', component: Config },
  { path: 'plans', label: 'navPlans', component: Plans },
  { path: 'garage-form', label: 'navGarageForm', component: GarageForm },
  { path: 'moderation', label: 'navModeration', component: Moderation },
  { path: 'push', label: 'navPush', component: Push },
];

function currentPath() {
  const p = window.location.hash.replace(/^#\/?/, '');
  return PAGES.some((x) => x.path === p) ? p : 'dashboard';
}

export function App() {
  const { t, lang, setLang } = useI18n();
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [email, setEmail] = useState('');
  const [path, setPath] = useState(currentPath);
  const [catalog, setCatalog] = useState<Category[]>([]);
  const [counts, setCounts] = useState({ garages: 0, users: 0, plans: 0 });

  useEffect(() => {
    const onHash = () => setPath(currentPath());
    const onLogout = () => setAuthed(false);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('mekano-logout', onLogout);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('mekano-logout', onLogout);
    };
  }, []);

  const reloadCatalog = useCallback(async () => {
    setCatalog(await api<Category[]>('/catalog'));
  }, []);

  const refreshCounts = useCallback(() => {
    api<Stats>('/stats')
      .then((s) =>
        setCounts({
          garages: s.totals.garages_pending ?? 0,
          users: s.totals.users_pending ?? 0,
          plans: s.totals.plan_requests ?? 0,
        })
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authed) return;
    api<{ email: string }>('/me')
      .then((me) => setEmail(me.email))
      .catch(() => {});
    reloadCatalog().catch(() => {});
    refreshCounts();
  }, [authed, reloadCatalog, refreshCounts]);

  useEffect(() => {
    document.title = t('appTitle');
  }, [t]);

  if (!authed) {
    return (
      <Login
        onLogin={(token, mail) => {
          setToken(token);
          setEmail(mail);
          setAuthed(true);
        }}
      />
    );
  }

  const Page = PAGES.find((p) => p.path === path)!.component;
  const badge = (p: string) =>
    p === 'garages'
      ? counts.garages + counts.plans
      : p === 'accounts'
        ? counts.users
        : p === 'plans'
          ? counts.plans
          : 0;

  return (
    <CatalogContext.Provider value={{ catalog, setCatalog, reloadCatalog }}>
      <CountsContext.Provider value={refreshCounts}>
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">
              <img src="/api/config/logo" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
              Mekano Admin
            </div>
            <nav className="nav">
              {PAGES.map((p) => (
                <a key={p.path} href={`#/${p.path}`} className={p.path === path ? 'active' : ''}>
                  {t(p.label)}
                  {badge(p.path) > 0 && <span className="count">{badge(p.path)}</span>}
                </a>
              ))}
            </nav>
            <div className="sidebar-foot">
              <div className="lang-switch">
                <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>
                  FR
                </button>
                <button className={lang === 'mg' ? 'on' : ''} onClick={() => setLang('mg')}>
                  MG
                </button>
              </div>
              <span className="sub" style={{ color: '#9fbcbe' }}>
                {email}
              </span>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setToken(null);
                  setAuthed(false);
                }}
              >
                {t('logout')}
              </button>
            </div>
          </aside>
          <main className="main">
            <Page />
          </main>
        </div>
      </CountsContext.Provider>
    </CatalogContext.Provider>
  );
}
