import { query } from './db/pool';

export type ServiceSubtype = {
  id: string;
  label: string;
  labelMg: string;
  active: boolean;
};

export type ServiceCategory = {
  id: string;
  emoji: string;
  label: string;
  labelMg: string;
  keywords: string[];
  active: boolean;
  subtypes: ServiceSubtype[];
};

type DefaultCategory = {
  id: string;
  emoji: string;
  label: string;
  subtypes: string[];
  keywords: string[];
};

/** Catalogue initial, inséré en base si elle est vide. */
export const DEFAULT_CATALOG: DefaultCategory[] = [
  {
    id: 'mecanique',
    emoji: '🔧',
    label: 'Garage mécanique',
    subtypes: ['Vidange', 'Moteur', 'Embrayage', 'Freinage'],
    keywords: ['mecanique', 'mecanicien', 'entretien', 'vidange', 'frein', 'moteur', 'embrayage', 'boite', 'suspension', 'echappement', '4x4', 'revision'],
  },
  {
    id: 'vulca',
    emoji: '🛞',
    label: 'Vulca',
    subtypes: ['Crevaison', 'Réparation pneu', 'Montage pneu'],
    keywords: ['vulca', 'vulcanisation', 'pneu', 'crevaison', 'jante', 'roue'],
  },
  {
    id: 'electricien',
    emoji: '⚡',
    label: 'Électricien automobile',
    subtypes: ['Batterie', 'Alternateur', 'Démarreur', 'Câblage'],
    keywords: ['electricien', 'electricite', 'electrique', 'batterie', 'alternateur', 'demarreur', 'cablage'],
  },
  {
    id: 'carrossier',
    emoji: '🚗',
    label: 'Carrossier',
    subtypes: ['Accident', 'Tôlerie', 'Peinture'],
    keywords: ['carrosserie', 'carrossier', 'accident', 'tolerie', 'peinture', 'bosse'],
  },
  {
    id: 'climatisation',
    emoji: '❄️',
    label: 'Climatisation auto',
    subtypes: ['Recharge clim', 'Réparation clim'],
    keywords: ['clim', 'climatisation'],
  },
  {
    id: 'moto',
    emoji: '🏍️',
    label: 'Garage moto',
    subtypes: ['Entretien moto', 'Réparation moto'],
    keywords: ['moto', 'scooter', 'deux roues'],
  },
  {
    id: 'lavage',
    emoji: '🚿',
    label: 'Lavage automobile',
    subtypes: ['Lavage', 'Nettoyage intérieur'],
    keywords: ['lavage', 'nettoyage', 'laver'],
  },
  {
    id: 'diagnostic',
    emoji: '🚘',
    label: 'Diagnostic automobile',
    subtypes: ['Scanner OBD', 'Diagnostic électronique'],
    keywords: ['diagnostic', 'obd', 'scanner', 'valise'],
  },
  {
    id: 'vitrage',
    emoji: '🪟',
    label: 'Pare-brise / vitrage',
    subtypes: ['Remplacement vitrage', 'Réparation vitrage'],
    keywords: ['pare brise', 'vitrage', 'vitre', 'retroviseur'],
  },
  {
    id: 'serrurier',
    emoji: '🔑',
    label: 'Serrurier automobile',
    subtypes: ['Clés', 'Télécommande', 'Ouverture'],
    keywords: ['serrurier', 'serrurerie', 'cle', 'telecommande', 'ouverture', 'antidemarrage'],
  },
  {
    id: 'pieces',
    emoji: '🧰',
    label: 'Pièces détachées',
    subtypes: ['Pièces auto', 'Pièces moto'],
    keywords: ['piece', 'pieces detachees', 'accessoire'],
  },
  {
    id: 'depannage',
    emoji: '🆘',
    label: 'Dépannage / remorquage',
    subtypes: ['Intervention sur route', 'Remorquage'],
    keywords: ['depannage', 'depanneuse', 'remorquage', 'remorque', 'sos', 'panne'],
  },
];

let catalog: ServiceCategory[] = DEFAULT_CATALOG.map((c) => ({
  id: c.id,
  emoji: c.emoji,
  label: c.label,
  labelMg: '',
  keywords: c.keywords,
  active: true,
  subtypes: c.subtypes.map((label) => ({
    id: label,
    label,
    labelMg: '',
    active: true,
  })),
}));
let catalogVersion = 0;

/** Insère le catalogue par défaut si la table est vide. */
export async function seedCatalogIfEmpty(): Promise<void> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM service_categories`
  );
  if (Number(rows[0].count) > 0) return;
  for (const [i, c] of DEFAULT_CATALOG.entries()) {
    await query(
      `INSERT INTO service_categories (id, emoji, label_fr, keywords, position)
       VALUES ($1,$2,$3,$4,$5)`,
      [c.id, c.emoji, c.label, c.keywords, i]
    );
    for (const [j, label] of c.subtypes.entries()) {
      await query(
        `INSERT INTO service_subtypes (category_id, label_fr, position)
         VALUES ($1,$2,$3)`,
        [c.id, label, j]
      );
    }
  }
}

/** Recharge le cache mémoire depuis la base (après chaque modification admin). */
export async function loadCatalog(): Promise<void> {
  const cats = await query<{
    id: string;
    emoji: string;
    label_fr: string;
    label_mg: string | null;
    keywords: string[] | null;
    active: boolean;
  }>(
    `SELECT id, emoji, label_fr, label_mg, keywords, active
     FROM service_categories ORDER BY position, label_fr`
  );
  const subs = await query<{
    id: string;
    category_id: string;
    label_fr: string;
    label_mg: string | null;
    active: boolean;
  }>(
    `SELECT id, category_id, label_fr, label_mg, active
     FROM service_subtypes ORDER BY position, label_fr`
  );
  catalog = cats.rows.map((c) => ({
    id: c.id,
    emoji: c.emoji,
    label: c.label_fr,
    labelMg: c.label_mg ?? '',
    keywords: c.keywords ?? [],
    active: c.active,
    subtypes: subs.rows
      .filter((s) => s.category_id === c.id)
      .map((s) => ({
        id: s.id,
        label: s.label_fr,
        labelMg: s.label_mg ?? '',
        active: s.active,
      })),
  }));
  catalogVersion = Date.now();
}

/** Catalogue complet (super admin). */
export function getFullCatalog(): ServiceCategory[] {
  return catalog;
}

/** Catalogue public : seulement les types et sous-types actifs. */
export function getPublicCatalog(): ServiceCategory[] {
  return catalog
    .filter((c) => c.active)
    .map((c) => ({ ...c, subtypes: c.subtypes.filter((s) => s.active) }));
}

export function getCatalogVersion(): number {
  return catalogVersion;
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

/** Identifiant stable dérivé d'un libellé (ex. 'Garage moto' → 'garage-moto'). */
export function slugify(text: string): string {
  return normalize(text).replace(/ /g, '-').slice(0, 40) || 'type';
}

/** `needle` apparaît en début de mot dans `haystack` (tous deux normalisés). */
function startsWord(haystack: string, needle: string): boolean {
  return needle.length > 0 && ` ${haystack}`.includes(` ${needle}`);
}

/** Catégorie d'un service : sous-type exact d'abord, sinon mot-clé. */
function categoryOfService(service: string, cats: ServiceCategory[]): string | null {
  const s = normalize(service);
  if (!s) return null;
  const exact = cats.find((c) => c.subtypes.some((sub) => normalize(sub.label) === s));
  if (exact) return exact.id;
  const byKeyword = cats.find((c) => c.keywords.some((kw) => startsWord(s, normalize(kw))));
  return byKeyword?.id ?? null;
}

/**
 * Type de service d'un garage (un seul) : le premier choix explicite valide,
 * sinon le type le plus représenté parmi ses services. Renvoie [] ou [id].
 */
export function resolveCategories(explicit: unknown, services: unknown): string[] {
  const cats = catalog;
  const known = new Set(cats.map((c) => c.id));
  if (Array.isArray(explicit)) {
    const chosen = explicit.find((id): id is string => typeof id === 'string' && known.has(id));
    if (chosen) return [chosen];
  }
  const counts = new Map<string, number>();
  if (Array.isArray(services)) {
    for (const s of services) {
      if (typeof s !== 'string') continue;
      const id = categoryOfService(s, cats);
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  for (const c of cats) {
    const n = counts.get(c.id) ?? 0;
    if (n > 0 && (best === null || n > (counts.get(best) ?? 0))) best = c.id;
  }
  return best ? [best] : [];
}

/** Retire les sous-types appartenant à un autre type que celui du garage (le texte libre reste). */
export function servicesForCategory(categoryIds: string[], services: unknown): string[] {
  if (!Array.isArray(services)) return [];
  const own = new Set(
    catalog
      .filter((c) => categoryIds.includes(c.id))
      .flatMap((c) => c.subtypes.map((s) => normalize(s.label)))
  );
  const foreign = new Set(
    catalog
      .filter((c) => !categoryIds.includes(c.id))
      .flatMap((c) => c.subtypes.map((s) => normalize(s.label)))
  );
  return services.filter(
    (s): s is string =>
      typeof s === 'string' && (own.has(normalize(s)) || !foreign.has(normalize(s)))
  );
}

/** Catégories correspondant à un texte de recherche (libellé, sous-type ou mot-clé). */
export function matchingCategoryIds(term: string): string[] {
  const t = normalize(term);
  if (t.length < 2) return [];
  return getPublicCatalog()
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

export function categoryLabel(id: string): string {
  const c = catalog.find((x) => x.id === id);
  return c ? `${c.emoji} ${c.label}` : id;
}
