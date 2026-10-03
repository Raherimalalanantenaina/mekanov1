import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  mdiBullhornOutline,
  mdiCogOutline,
  mdiCrownOutline,
  mdiFormSelect,
  mdiGarageVariant,
  mdiLogout,
  mdiMenu,
  mdiShapeOutline,
  mdiShieldCheckOutline,
  mdiViewDashboardOutline,
} from '@mdi/js';
import { api, getToken, setToken } from './api';
import { useI18n, type TKey } from './i18n';
import type { Category, Stats } from './types';
import { MdiIcon } from './CategoryIcon';
import { NotificationBell } from './NotificationBell';
import { Avatar } from './ui';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Catalog } from './pages/Catalog';
import { Garages } from './pages/Garages';
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

type Page = { path: string; label: TKey; icon: string; component: React.ComponentType };

const SECTIONS: { label: TKey; pages: Page[] }[] = [
  {
    label: 'navSectionMain',
    pages: [{ path: 'dashboard', label: 'navDashboard', icon: mdiViewDashboardOutline, component: Dashboard }],
  },
  {
    label: 'navSectionManage',
    pages: [
      { path: 'garages', label: 'navGarages', icon: mdiGarageVariant, component: Garages },
      { path: 'moderation', label: 'navModeration', icon: mdiShieldCheckOutline, component: Moderation },
      { path: 'push', label: 'navPush', icon: mdiBullhornOutline, component: Push },
    ],
  },
  {
    label: 'navSectionCatalog',
    pages: [
      { path: 'catalog', label: 'navCatalog', icon: mdiShapeOutline, component: Catalog },
      { path: 'plans', label: 'navPlans', icon: mdiCrownOutline, component: Plans },
    ],
  },
  {
    label: 'navSectionSettings',
    pages: [
      { path: 'config', label: 'navConfig', icon: mdiCogOutline, component: Config },
      { path: 'garage-form', label: 'navGarageForm', icon: mdiFormSelect, component: GarageForm },
    ],
  },
];

const PAGES = SECTIONS.flatMap((s) => s.pages);

/** Paramètres après « ? » dans le hash (ex. #/garages?status=pending). */
export function hashParams() {
  const q = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(q);
}

function currentPath() {
  const p = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return PAGES.some((x) => x.path === p) ? p : 'dashboard';
}

export function App() {
  const { t, lang, setLang } = useI18n();
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [email, setEmail] = useState('');
  const [path, setPath] = useState(currentPath);
  const [hashKey, setHashKey] = useState(window.location.hash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const [catalog, setCatalog] = useState<Category[]>([]);
  const [counts, setCounts] = useState({ garages: 0, users: 0, plans: 0 });

  useEffect(() => {
    const onHash = () => {
      setPath(currentPath());
      setHashKey(window.location.hash);
      setMenuOpen(false);
    };
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

  const page = PAGES.find((p) => p.path === path)!;
  const Page = page.component;
  const badge = (p: string) =>
    p === 'garages' ? counts.garages + counts.plans : p === 'plans' ? counts.plans : 0;
  const logout = () => {
    setToken(null);
    setAuthed(false);
  };

  return (
    <CatalogContext.Provider value={{ catalog, setCatalog, reloadCatalog }}>
      <CountsContext.Provider value={refreshCounts}>
        <div className={`layout ${menuOpen ? 'menu-open' : ''}`}>
          <aside className="sidebar">
            <div className="brand">
              {logoOk ? (
                <img src="/api/config/logo" alt="" onError={() => setLogoOk(false)} />
              ) : (
                <span className="brand-mark">
                  <MdiIcon path={mdiGarageVariant} size={22} />
                </span>
              )}
              <div>
                <strong>Mekano</strong>
                <span>Admin</span>
              </div>
            </div>
            <nav className="nav">
              {SECTIONS.map((s) => (
                <div key={s.label} className="nav-section">
                  <div className="nav-title">{t(s.label)}</div>
                  {s.pages.map((p) => (
                    <a key={p.path} href={`#/${p.path}`} className={p.path === path ? 'active' : ''}>
                      <MdiIcon path={p.icon} size={20} />
                      <span>{t(p.label)}</span>
                      {badge(p.path) > 0 && <span className="count">{badge(p.path)}</span>}
                    </a>
                  ))}
                </div>
              ))}
            </nav>
            <div className="sidebar-foot">
              <Avatar name={email || 'Admin'} size={34} />
              <div className="who">
                <strong>Super admin</strong>
                <span>{email}</span>
              </div>
              <button className="icon-btn" data-tip={t('logout')} aria-label={t('logout')} onClick={logout}>
                <MdiIcon path={mdiLogout} size={18} />
              </button>
            </div>
          </aside>
          <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />
          <div className="content">
            <header className="topbar">
              <button className="topbar-btn burger" aria-label="menu" onClick={() => setMenuOpen(true)}>
                <MdiIcon path={mdiMenu} size={22} />
              </button>
              <div className="crumbs">
                <MdiIcon path={page.icon} size={18} />
                <span>{t(page.label)}</span>
              </div>
              <div className="spacer" />
              <div className="lang-switch">
                <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>
                  FR
                </button>
                <button className={lang === 'mg' ? 'on' : ''} onClick={() => setLang('mg')}>
                  MG
                </button>
              </div>
              <NotificationBell onChange={refreshCounts} />
            </header>
            <main className="main">
              <Page key={hashKey} />
            </main>
          </div>
        </div>
      </CountsContext.Provider>
    </CatalogContext.Provider>
  );
}
