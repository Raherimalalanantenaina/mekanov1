import { query } from './db/pool';
import { getConfig, PLAN_IDS, type PlanFeatures, type PlanId } from './appSettings';

/** Offre effective en SQL : un abonnement expiré retombe en gratuit. */
export function effectivePlanSql(alias = ''): string {
  const c = alias ? `${alias}.` : '';
  return `(CASE WHEN ${c}plan_expires_at IS NOT NULL AND ${c}plan_expires_at < NOW() THEN 'free' ELSE ${c}plan END)`;
}

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && (PLAN_IDS as readonly string[]).includes(v);
}

export function effectivePlan(plan: string | null | undefined, expiresAt: string | Date | null | undefined): PlanId {
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'free';
  return isPlanId(plan) ? plan : 'free';
}

export async function planFeatures(plan: PlanId): Promise<PlanFeatures> {
  return (await getConfig()).config.plans[plan].features;
}

/** Offres dont les garages remontent en tête des résultats. */
export async function boostedPlans(): Promise<PlanId[]> {
  const { plans } = (await getConfig()).config;
  return PLAN_IDS.filter((id) => plans[id].features.boost);
}

/** Fonctionnalités de l'offre effective d'un garage (null si garage introuvable). */
export async function garageFeatures(garageId: string): Promise<PlanFeatures | null> {
  const { rows } = await query<{ plan: string; plan_expires_at: string | null }>(
    `SELECT plan, plan_expires_at FROM garages WHERE id = $1`,
    [garageId]
  );
  if (!rows[0]) return null;
  return planFeatures(effectivePlan(rows[0].plan, rows[0].plan_expires_at));
}

type MappedGarage = {
  plan: PlanId;
  phone: string;
  photos: string[];
  openingHours: string;
  hoursJson: unknown;
  promo: string;
  priceList: unknown[];
  mobileService: boolean;
  services: string[];
  rating: number | null;
  reviewCount: number;
};

/**
 * Fiche publique : retire ce que l'offre du garage n'inclut pas et joint
 * la liste des fonctionnalités pour que l'app affiche les bons boutons.
 */
export async function withPlan<T extends MappedGarage>(
  g: T,
  opts: { public: boolean }
): Promise<T & { features: PlanFeatures }> {
  const { plans } = (await getConfig()).config;
  const plan = plans[g.plan];
  const f = plan.features;
  if (!opts.public) return { ...g, features: f };
  return {
    ...g,
    features: f,
    phone: f.phone ? g.phone : '',
    photos: f.photos ? g.photos : [],
    openingHours: f.hours ? g.openingHours : '',
    hoursJson: f.hours ? g.hoursJson : null,
    promo: f.extras ? g.promo : '',
    priceList: f.extras ? g.priceList : [],
    mobileService: f.extras ? g.mobileService : false,
    services: plan.maxServices > 0 ? g.services.slice(0, plan.maxServices) : g.services,
    rating: f.reviews ? g.rating : null,
    reviewCount: f.reviews ? g.reviewCount : 0,
  };
}
