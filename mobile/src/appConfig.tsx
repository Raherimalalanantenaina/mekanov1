import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import type { Lang } from './i18n';
import { DEFAULT_CATALOG, setCatalog, type ServiceCategory } from './serviceCatalog';

/** Réglages de l'app pilotés par le site super admin (GET /api/config). */
export type LocalizedText = { fr: string; mg: string };
export type FieldRule = { visible: boolean; required: boolean };
export type GarageFormField =
  | 'phone'
  | 'city'
  | 'description'
  | 'hours'
  | 'promo'
  | 'prices'
  | 'photos'
  | 'mobileService';

export type AppConfig = {
  appName: string;
  colors: { primary: string; accent: string };
  texts: {
    heroTitle1: LocalizedText;
    heroTitle2: LocalizedText;
    searchPlaceholder: LocalizedText;
  };
  features: {
    quotes: boolean;
    appointments: boolean;
    reviews: boolean;
    sos: boolean;
    whatsapp: boolean;
    share: boolean;
  };
  garageForm: {
    maxPhotos: number;
    minCategories: number;
    fields: Record<GarageFormField, FieldRule>;
  };
  approval: { accounts: boolean; garages: boolean };
  support: { phone: string; email: string };
};

const empty = (): LocalizedText => ({ fr: '', mg: '' });
const field = (): FieldRule => ({ visible: true, required: false });

export const DEFAULT_CONFIG: AppConfig = {
  appName: 'Mekano',
  colors: { primary: '#12717A', accent: '#F0A72C' },
  texts: {
    heroTitle1: empty(),
    heroTitle2: empty(),
    searchPlaceholder: empty(),
  },
  features: {
    quotes: true,
    appointments: true,
    reviews: true,
    sos: true,
    whatsapp: true,
    share: true,
  },
  garageForm: {
    maxPhotos: 12,
    minCategories: 1,
    fields: {
      phone: field(),
      city: field(),
      description: field(),
      hours: field(),
      promo: field(),
      prices: field(),
      photos: field(),
      mobileService: field(),
    },
  },
  approval: { accounts: true, garages: true },
  support: { phone: '', email: '' },
};

type RemoteConfig = {
  version: string;
  config: AppConfig;
  catalog: ServiceCategory[];
  logoUrl: string | null;
};

type AppConfigValue = {
  config: AppConfig;
  catalog: ServiceCategory[];
  /** URL absolue du logo personnalisé, null = logo intégré à l'app */
  logoUri: string | null;
  version: string;
};

const CACHE_KEY = 'mekano:appConfig:v1';

/** Complète une config reçue avec les valeurs par défaut (champs ajoutés plus tard). */
function withDefaults(c: Partial<AppConfig> | undefined): AppConfig {
  const d = DEFAULT_CONFIG;
  return {
    ...d,
    ...c,
    colors: { ...d.colors, ...c?.colors },
    texts: { ...d.texts, ...c?.texts },
    features: { ...d.features, ...c?.features },
    garageForm: {
      ...d.garageForm,
      ...c?.garageForm,
      fields: { ...d.garageForm.fields, ...c?.garageForm?.fields },
    },
    approval: { ...d.approval, ...c?.approval },
    support: { ...d.support, ...c?.support },
  };
}

const initial: AppConfigValue = {
  config: DEFAULT_CONFIG,
  catalog: DEFAULT_CATALOG,
  logoUri: null,
  version: '',
};

const AppConfigContext = createContext<AppConfigValue>(initial);

function toValue(remote: RemoteConfig): AppConfigValue {
  const catalog = remote.catalog?.length ? remote.catalog : DEFAULT_CATALOG;
  setCatalog(catalog);
  return {
    config: withDefaults(remote.config),
    catalog,
    logoUri: remote.logoUrl ? `${API_BASE_URL}${remote.logoUrl}` : null,
    version: remote.version ?? '',
  };
}

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<AppConfigValue>(initial);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (!raw || cancelled) return;
        setValue((current) =>
          current.version ? current : toValue(JSON.parse(raw) as RemoteConfig)
        );
      })
      .catch(() => {});

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch(`${API_BASE_URL}/api/config`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<RemoteConfig>) : null))
      .then((remote) => {
        if (!remote || cancelled) return;
        setValue(toValue(remote));
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote)).catch(() => {});
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const memo = useMemo(() => value, [value]);
  return <AppConfigContext.Provider value={memo}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}

/** Texte configuré dans la langue choisie, sinon texte par défaut de l'app. */
export function configText(text: LocalizedText | undefined, lang: Lang, fallback: string): string {
  return (lang === 'mg' ? text?.mg : text?.fr) || fallback;
}
