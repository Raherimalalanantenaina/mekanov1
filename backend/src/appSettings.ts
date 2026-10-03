import { query } from './db/pool';

export const GARAGE_FORM_FIELDS = [
  'phone',
  'city',
  'description',
  'hours',
  'promo',
  'prices',
  'photos',
  'mobileService',
] as const;

export type GarageFormField = (typeof GARAGE_FORM_FIELDS)[number];

export const PLAN_IDS = ['free', 'basic', 'standard', 'premium'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Fonctionnalités activables par offre. `extras` = promo, tarifs, déplacement. */
export const PLAN_FEATURES = [
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
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];
export type PlanFeatures = Record<PlanFeature, boolean>;

export type Plan = {
  name: { fr: string; mg: string };
  /** Prix mensuel en ariary (0 = gratuit) */
  price: number;
  /** Nombre de sous-types affichés publiquement (0 = illimité) */
  maxServices: number;
  features: PlanFeatures;
};
export type LocalizedText = { fr: string; mg: string };
export type FieldRule = { visible: boolean; required: boolean };

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

function features(on: PlanFeature[]): PlanFeatures {
  return Object.fromEntries(PLAN_FEATURES.map((f) => [f, on.includes(f)])) as PlanFeatures;
}

export const DEFAULT_PLANS: Record<PlanId, Plan> = {
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
    features: features([...PLAN_FEATURES]),
  },
};

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
      phone: { visible: true, required: false },
      city: { visible: true, required: false },
      description: { visible: true, required: false },
      hours: { visible: true, required: false },
      promo: { visible: true, required: false },
      prices: { visible: true, required: false },
      photos: { visible: true, required: false },
      mobileService: { visible: true, required: false },
    },
  },
  approval: { accounts: true, garages: true },
  support: { phone: '', email: '' },
  plans: DEFAULT_PLANS,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

type Loose = Record<string, any>;

function str(v: unknown, fallback: string, max = 200): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function text(v: unknown, fallback: LocalizedText): LocalizedText {
  const o = (v ?? {}) as Loose;
  return { fr: str(o.fr, fallback.fr), mg: str(o.mg, fallback.mg) };
}

/** Fusionne une config partielle/inconnue avec les valeurs par défaut (et la valide). */
export function sanitizeConfig(input: unknown, base: AppConfig = DEFAULT_CONFIG): AppConfig {
  const i = (input ?? {}) as Loose;
  const colors = i.colors ?? {};
  const texts = i.texts ?? {};
  const features = i.features ?? {};
  const form = i.garageForm ?? {};
  const fields = form.fields ?? {};
  const approval = i.approval ?? {};
  const support = i.support ?? {};
  const plans = i.plans ?? {};
  const maxPhotos = Number(form.maxPhotos);
  const minCategories = Number(form.minCategories);
  return {
    appName: str(i.appName, base.appName, 40).trim() || base.appName,
    colors: {
      primary: HEX.test(colors.primary) ? colors.primary : base.colors.primary,
      accent: HEX.test(colors.accent) ? colors.accent : base.colors.accent,
    },
    texts: {
      heroTitle1: text(texts.heroTitle1, base.texts.heroTitle1),
      heroTitle2: text(texts.heroTitle2, base.texts.heroTitle2),
      searchPlaceholder: text(texts.searchPlaceholder, base.texts.searchPlaceholder),
    },
    features: {
      quotes: bool(features.quotes, base.features.quotes),
      appointments: bool(features.appointments, base.features.appointments),
      reviews: bool(features.reviews, base.features.reviews),
      sos: bool(features.sos, base.features.sos),
      whatsapp: bool(features.whatsapp, base.features.whatsapp),
      share: bool(features.share, base.features.share),
    },
    garageForm: {
      maxPhotos:
        Number.isFinite(maxPhotos) && maxPhotos >= 1 && maxPhotos <= 30
          ? Math.round(maxPhotos)
          : base.garageForm.maxPhotos,
      minCategories:
        Number.isFinite(minCategories) && minCategories >= 0 && minCategories <= 1
          ? Math.round(minCategories)
          : base.garageForm.minCategories,
      fields: Object.fromEntries(
        GARAGE_FORM_FIELDS.map((f) => {
          const b = base.garageForm.fields[f];
          const r = fields[f] ?? {};
          const visible = bool(r.visible, b.visible);
          return [f, { visible, required: visible && bool(r.required, b.required) }];
        })
      ) as Record<GarageFormField, FieldRule>,
    },
    approval: {
      accounts: bool(approval.accounts, base.approval.accounts),
      garages: bool(approval.garages, base.approval.garages),
    },
    support: {
      phone: str(support.phone, base.support.phone, 40),
      email: str(support.email, base.support.email, 120),
    },
    plans: Object.fromEntries(
      PLAN_IDS.map((id) => {
        const b = base.plans?.[id] ?? DEFAULT_PLANS[id];
        const p = plans[id] ?? {};
        const price = Number(p.price);
        const maxServices = Number(p.maxServices);
        const f = p.features ?? {};
        return [
          id,
          {
            name: text(p.name, b.name),
            price: Number.isFinite(price) && price >= 0 ? Math.round(price) : b.price,
            maxServices:
              Number.isFinite(maxServices) && maxServices >= 0 && maxServices <= 50
                ? Math.round(maxServices)
                : b.maxServices,
            features: Object.fromEntries(
              PLAN_FEATURES.map((k) => [k, bool(f[k], b.features[k])])
            ) as PlanFeatures,
          },
        ];
      })
    ) as Record<PlanId, Plan>,
  };
}

let cached: { config: AppConfig; updatedAt: number } | null = null;

export async function getConfig(): Promise<{ config: AppConfig; updatedAt: number }> {
  if (cached) return cached;
  const { rows } = await query<{ value: unknown; updated_at: string }>(
    `SELECT value, updated_at FROM app_settings WHERE key = 'app'`
  );
  cached = {
    config: sanitizeConfig(rows[0]?.value),
    updatedAt: rows[0] ? new Date(rows[0].updated_at).getTime() : 0,
  };
  return cached;
}

export async function saveConfig(input: unknown): Promise<AppConfig> {
  const current = (await getConfig()).config;
  const next = sanitizeConfig(input, current);
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('app', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(next)]
  );
  cached = null;
  return next;
}

/** Logo : data URL stockée en base, servie en binaire par /api/config/logo. */
export async function getLogo(): Promise<{ dataUrl: string; updatedAt: number } | null> {
  const { rows } = await query<{ value: string | null; updated_at: string }>(
    `SELECT value #>> '{}' AS value, updated_at FROM app_settings WHERE key = 'logo'`
  );
  if (!rows[0]?.value) return null;
  return { dataUrl: rows[0].value, updatedAt: new Date(rows[0].updated_at).getTime() };
}

export async function getLogoVersion(): Promise<number | null> {
  const { rows } = await query<{ updated_at: string }>(
    `SELECT updated_at FROM app_settings WHERE key = 'logo'`
  );
  return rows[0] ? new Date(rows[0].updated_at).getTime() : null;
}

export async function saveLogo(dataUrl: string | null): Promise<void> {
  if (!dataUrl) {
    await query(`DELETE FROM app_settings WHERE key = 'logo'`);
    return;
  }
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('logo', to_jsonb($1::text), NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [dataUrl]
  );
}
