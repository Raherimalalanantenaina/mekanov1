/**
 * Catalogue des types de service (catégories) et de leurs sous-types.
 * Géré depuis le site super admin et chargé via /api/config (voir appConfig.tsx) ;
 * DEFAULT_CATALOG sert tant que la config n'est pas encore reçue.
 *
 * - `categories` d'un garage : liste d'ids (ex. 'vulca')
 * - `services` d'un garage : libellés des sous-types (ex. 'Réparation pneu')
 * - `keywords` : mots reconnus en recherche et pour classer les anciens services
 */
import type { Lang } from './i18n';

export type ServiceSubtype = {
  id: string;
  label: string;
  labelMg: string;
};

export type ServiceCategory = {
  id: string;
  /** Nom d'icône MaterialCommunityIcons choisi dans le site admin */
  icon?: string;
  label: string;
  labelMg: string;
  keywords: string[];
  subtypes: ServiceSubtype[];
};

const cat = (
  id: string,
  icon: string,
  label: string,
  subtypes: string[],
  keywords: string[]
): ServiceCategory => ({
  id,
  icon,
  label,
  labelMg: '',
  keywords,
  subtypes: subtypes.map((s) => ({ id: s, label: s, labelMg: '' })),
});

export const DEFAULT_CATALOG: ServiceCategory[] = [
  cat('mecanique', 'wrench', 'Garage mécanique', ['Vidange', 'Moteur', 'Embrayage', 'Freinage'], ['mecanique', 'mecanicien', 'entretien', 'vidange', 'frein', 'moteur', 'embrayage', 'boite', 'suspension', 'echappement', '4x4', 'revision']),
  cat('vulca', 'tire', 'Vulca', ['Crevaison', 'Réparation pneu', 'Montage pneu'], ['vulca', 'vulcanisation', 'pneu', 'crevaison', 'jante', 'roue']),
  cat('electricien', 'car-battery', 'Électricien automobile', ['Batterie', 'Alternateur', 'Démarreur', 'Câblage'], ['electricien', 'electricite', 'electrique', 'batterie', 'alternateur', 'demarreur', 'cablage']),
  cat('carrossier', 'spray', 'Carrossier', ['Accident', 'Tôlerie', 'Peinture'], ['carrosserie', 'carrossier', 'accident', 'tolerie', 'peinture', 'bosse']),
  cat('climatisation', 'snowflake', 'Climatisation auto', ['Recharge clim', 'Réparation clim'], ['clim', 'climatisation']),
  cat('moto', 'motorbike', 'Garage moto', ['Entretien moto', 'Réparation moto'], ['moto', 'scooter', 'deux roues']),
  cat('lavage', 'car-wash', 'Lavage automobile', ['Lavage', 'Nettoyage intérieur'], ['lavage', 'nettoyage', 'laver']),
  cat('diagnostic', 'car-cog', 'Diagnostic automobile', ['Scanner OBD', 'Diagnostic électronique'], ['diagnostic', 'obd', 'scanner', 'valise']),
  cat('vitrage', 'car-windshield', 'Pare-brise / vitrage', ['Remplacement vitrage', 'Réparation vitrage'], ['pare brise', 'vitrage', 'vitre', 'retroviseur']),
  cat('serrurier', 'key-variant', 'Serrurier automobile', ['Clés', 'Télécommande', 'Ouverture'], ['serrurier', 'serrurerie', 'cle', 'telecommande', 'ouverture', 'antidemarrage']),
  cat('pieces', 'cog', 'Pièces détachées', ['Pièces auto', 'Pièces moto'], ['piece', 'pieces detachees', 'accessoire']),
  cat('depannage', 'tow-truck', 'Dépannage / remorquage', ['Intervention sur route', 'Remorquage'], ['depannage', 'depanneuse', 'remorquage', 'remorque', 'sos', 'panne']),
];

let catalog: ServiceCategory[] = DEFAULT_CATALOG;

export function setCatalog(next: ServiceCategory[]) {
  if (Array.isArray(next) && next.length > 0) catalog = next;
}

export function getCatalog(): ServiceCategory[] {
  return catalog;
}

export function getCategory(id: string): ServiceCategory | undefined {
  return catalog.find((c) => c.id === id);
}

/** Libellé dans la langue choisie (repli sur le français). */
export function localized(item: { label: string; labelMg?: string }, lang: Lang): string {
  return (lang === 'mg' && item.labelMg) || item.label;
}

export function categoryLabel(id: string, lang: Lang = 'fr'): string {
  const c = getCategory(id);
  return c ? localized(c, lang) : id;
}

/** Minuscules, sans accents, ponctuation → espaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** `needle` apparaît en début de mot dans `haystack` (tous deux normalisés). */
function startsWord(haystack: string, needle: string): boolean {
  return needle.length > 0 && ` ${haystack}`.includes(` ${needle}`);
}

/** Catégorie d'un service : sous-type exact d'abord, sinon mot-clé. */
function categoryOfService(service: string): string | null {
  const s = normalize(service);
  if (!s) return null;
  const exact = catalog.find((c) =>
    c.subtypes.some((sub) => normalize(sub.label) === s)
  );
  if (exact) return exact.id;
  const byKeyword = catalog.find((c) =>
    c.keywords.some((kw) => startsWord(s, normalize(kw)))
  );
  return byKeyword?.id ?? null;
}

/** Type déduit des services (garages créés avant les types) : le plus représenté. */
export function resolveCategories(services: string[]): string[] {
  const counts = new Map<string, number>();
  for (const s of services) {
    const id = categoryOfService(s);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const c of catalog) {
    const n = counts.get(c.id) ?? 0;
    if (n > 0 && (best === null || n > (counts.get(best) ?? 0))) best = c.id;
  }
  return best ? [best] : [];
}

/** Catégories correspondant à un texte de recherche (libellé, sous-type ou mot-clé). */
export function matchingCategoryIds(term: string): string[] {
  const t = normalize(term);
  if (t.length < 2) return [];
  return catalog
    .filter((c) => {
      const names = [
        c.label,
        c.labelMg,
        ...c.subtypes.flatMap((s) => [s.label, s.labelMg]),
        ...c.keywords,
      ]
        .filter(Boolean)
        .map(normalize);
      return (
        names.some((n) => startsWord(n, t)) ||
        c.keywords.some((kw) => startsWord(t, normalize(kw)))
      );
    })
    .map((c) => c.id);
}

type GarageLike = {
  name: string;
  city: string;
  address?: string;
  categories?: string[];
  services: string[];
};

/** Type d'un garage, un seul (repli sur les services pour les anciennes fiches). */
export function garageCategoryIds(g: GarageLike): string[] {
  const known = new Set(catalog.map((c) => c.id));
  const ids = (g.categories ?? []).filter((id) => known.has(id)).slice(0, 1);
  return ids.length ? ids : resolveCategories(g.services);
}

/** Filtre local (cache hors ligne, carte) équivalent à la recherche du serveur. */
export function garageMatches(
  g: GarageLike,
  params: { q?: string; category?: string; service?: string }
): boolean {
  const ids = garageCategoryIds(g);
  if (params.category && !ids.includes(params.category)) return false;
  if (params.service) {
    const s = params.service.toLowerCase();
    if (!g.services.some((x) => x.toLowerCase() === s)) return false;
  }
  const q = params.q?.trim().toLowerCase();
  if (!q) return true;
  const matched = matchingCategoryIds(q);
  return (
    g.name.toLowerCase().includes(q) ||
    g.city.toLowerCase().includes(q) ||
    (g.address ?? '').toLowerCase().includes(q) ||
    g.services.some((s) => s.toLowerCase().includes(q)) ||
    ids.some((id) => matched.includes(id))
  );
}
