/**
 * Catalogue des types de service (catégories) et de leurs sous-types.
 * Doit rester identique à mobile/src/serviceCatalog.ts.
 *
 * - `categories` d'un garage : liste d'ids (ex. 'vulca')
 * - `services` d'un garage : libellés des sous-types (ex. 'Réparation pneu')
 * - `keywords` : mots reconnus en recherche et pour classer les anciens services
 */
export type ServiceCategory = {
  id: string;
  emoji: string;
  label: string;
  subtypes: string[];
  keywords: string[];
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
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

const CATEGORY_IDS = new Set(SERVICE_CATEGORIES.map((c) => c.id));

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
  const exact = SERVICE_CATEGORIES.find((c) =>
    c.subtypes.some((sub) => normalize(sub) === s)
  );
  if (exact) return exact.id;
  const byKeyword = SERVICE_CATEGORIES.find((c) =>
    c.keywords.some((kw) => startsWord(s, normalize(kw)))
  );
  return byKeyword?.id ?? null;
}

/** Ids de catégories valides = choix explicites + catégories déduites des services. */
export function resolveCategories(
  explicit: unknown,
  services: unknown
): string[] {
  const ids = new Set<string>();
  if (Array.isArray(explicit)) {
    for (const id of explicit) {
      if (typeof id === 'string' && CATEGORY_IDS.has(id)) ids.add(id);
    }
  }
  if (Array.isArray(services)) {
    for (const s of services) {
      if (typeof s !== 'string') continue;
      const id = categoryOfService(s);
      if (id) ids.add(id);
    }
  }
  return SERVICE_CATEGORIES.filter((c) => ids.has(c.id)).map((c) => c.id);
}

/** Catégories correspondant à un texte de recherche (libellé, sous-type ou mot-clé). */
export function matchingCategoryIds(term: string): string[] {
  const t = normalize(term);
  if (t.length < 2) return [];
  return SERVICE_CATEGORIES.filter((c) => {
    const names = [c.label, ...c.subtypes, ...c.keywords].map(normalize);
    return (
      names.some((n) => startsWord(n, t)) ||
      c.keywords.some((kw) => startsWord(t, normalize(kw)))
    );
  }).map((c) => c.id);
}

export function categoryLabel(id: string): string {
  const c = SERVICE_CATEGORIES.find((x) => x.id === id);
  return c ? `${c.emoji} ${c.label}` : id;
}
