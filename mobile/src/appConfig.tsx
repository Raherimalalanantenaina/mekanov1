import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import { useSync } from './sync';
import type { Lang } from './i18n';
import { DEFAULT_CATALOG, setCatalog, type ServiceCategory } from './serviceCatalog';
import type { Garage, PlanFeature, PlanFeatures, PlanId } from './types';

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

export const PLAN_IDS: PlanId[] = ['free', 'basic', 'standard', 'premium'];
export const PLAN_FEATURES: PlanFeature[] = [
  'phone',
  'route',
  'photos',
  'hours',
  'extras',
  'quotes',
  'appointments',
  'whatsapp',
  'reviews',
  'boost',
];

export type Plan = {
  name: LocalizedText;
  /** Prix mensuel en ariary (0 = gratuit) */
  price: number;
  /** Sous-types affichés publiquement (0 = illimité) */
  maxServices: number;
  features: PlanFeatures;
};

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
  plans: Record<PlanId, Plan>;
};

const empty = (): LocalizedText => ({ fr: '', mg: '' });
const field = (): FieldRule => ({ visible: true, required: false });
const features = (on: PlanFeature[]): PlanFeatures =>
  Object.fromEntries(PLAN_FEATURES.map((f) => [f, on.includes(f)])) as PlanFeatures;

export const ALL_FEATURES: PlanFeatures = features(PLAN_FEATURES);

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
  plans: {
    free: {
      name: { fr: 'Gratuite', mg: 'Maimaim-poana' },
      price: 0,
      maxServices: 3,
      features: features(['phone']),
    },
    basic: {
      name: { fr: 'Basique', mg: 'Fototra' },
      price: 5000,
      maxServices: 3,
      features: features(['phone', 'route']),
    },
    standard: {
      name: { fr: 'Standard', mg: 'Standard' },
      price: 15000,
      maxServices: 0,
      features: features(['phone', 'route', 'photos', 'hours', 'extras']),
    },
    premium: {
      name: { fr: 'Premium', mg: 'Premium' },
      price: 30000,
      maxServices: 0,
      features: ALL_FEATURES,
    },
  },
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
    plans: Object.fromEntries(
      PLAN_IDS.map((id) => {
        const p = c?.plans?.[id];
        return [
          id,
          {
            ...d.plans[id],
            ...p,
            name: { ...d.plans[id].name, ...p?.name },
            features: { ...d.plans[id].features, ...p?.features },
          },
        ];
      })
    ) as Record<PlanId, Plan>,
  };
}

/** Fonctionnalités d'un garage (fiche venue d'un ancien serveur / cache = tout autorisé). */
export function garageFeatures(g: Pick<Garage, 'features'>): PlanFeatures {
  return g.features ?? ALL_FEATURES;
}

export function planName(config: AppConfig, id: PlanId, lang: Lang): string {
  return configText(config.plans[id]?.name, lang, id);
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

  const refresh = useCallback(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch(`${API_BASE_URL}/api/config`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<RemoteConfig>) : null))
      .then((remote) => {
        if (!remote) return;
        setValue((current) => (current.version === remote.version ? current : toValue(remote)));
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote)).catch(() => {});
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }, []);

  // Config, catalogue ou logo modifiés dans le back-office
  useSync(['config'], refresh);

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
