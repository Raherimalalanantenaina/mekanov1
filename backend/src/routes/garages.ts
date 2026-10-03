import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db/pool';
import { config } from '../config';
import { sendAdminNotice, sendAdminValidationEmail } from '../mailer';
import { boostedPlans, effectivePlanSql, effectivePlan, garageFeatures, isPlanId, withPlan } from '../plans';
import { AuthedRequest, requireGarageAuth } from '../middleware/auth';
import { getConfig } from '../appSettings';
import {
  categoryLabel,
  matchingCategoryIds,
  resolveCategories,
  servicesForCategory,
} from '../serviceCatalog';

/** Horaires d'une journée : { open: 'HH:MM', close: 'HH:MM', closed: bool } */
export type DayHours = { open: string; close: string; closed: boolean };

export type GarageRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  categories: string[];
  services: string[];
  photos: string[];
  plan: string;
  plan_expires_at: string | null;
  plan_request: string | null;
  plan_requested_at: string | null;
  mobile_service: boolean;
  promo: string;
  price_list: { service: string; price: string }[];
  views: number;
  calls: number;
  opening_hours: string;
  hours_json: DayHours[] | null;
  is_open: boolean;
  status: 'pending' | 'approved' | 'hidden';
  updated_at: string;
  created_at: string;
  distance_km?: number;
  avg_rating?: number | null;
  review_count?: number;
};

export function mapGarage(row: GarageRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    address: row.address,
    city: row.city,
    phone: row.phone,
    latitude: row.latitude,
    longitude: row.longitude,
    categories: row.categories ?? [],
    services: row.services ?? [],
    photos: row.photos ?? [],
    mobileService: row.mobile_service ?? false,
    promo: row.promo ?? '',
    priceList: row.price_list ?? [],
    views: row.views ?? 0,
    calls: row.calls ?? 0,
    openingHours: row.opening_hours,
    hoursJson: row.hours_json ?? null,
    isOpen: row.is_open,
    status: row.status ?? 'approved',
    plan: effectivePlan(row.plan, row.plan_expires_at),
    planExpiresAt: row.plan_expires_at ?? null,
    planRequest: isPlanId(row.plan_request) ? row.plan_request : null,
    planRequestedAt: row.plan_requested_at ?? null,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    distanceKm:
      row.distance_km != null ? Number(row.distance_km) : undefined,
    rating: row.avg_rating != null ? Number(row.avg_rating) : null,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
  };
}

export const RATING_SELECT = `,
  (SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.garage_id = garages.id) AS avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.garage_id = garages.id) AS review_count`;

/** Champs obligatoires du formulaire garage, définis dans la config super admin. */
export function checkGarageForm(
  appConfig: Awaited<ReturnType<typeof getConfig>>['config'],
  g: {
    phone?: string;
    city?: string;
    description?: string;
    photos?: unknown[];
    categories: string[];
  }
): string | null {
  const f = appConfig.garageForm.fields;
  if (f.phone.required && !g.phone?.trim()) return 'Téléphone obligatoire';
  if (f.city.required && !g.city?.trim()) return 'Ville obligatoire';
  if (f.description.required && !g.description?.trim()) return 'Description obligatoire';
  if (f.photos.required && !g.photos?.length) return 'Au moins une photo est obligatoire';
  if ((g.photos?.length ?? 0) > appConfig.garageForm.maxPhotos) {
    return `${appConfig.garageForm.maxPhotos} photos maximum`;
  }
  if (g.categories.length < appConfig.garageForm.minCategories) {
    return 'Choisis le type de service du garage';
  }
  return null;
}

const router = Router();

/** Liste publique + recherche + géoloc optionnelle */
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const city = String(req.query.city || '').trim();
  const category = String(req.query.category || '').trim();
  const service = String(req.query.service || '').trim();
  const lat = req.query.lat != null ? Number(req.query.lat) : null;
  const lng = req.query.lng != null ? Number(req.query.lng) : null;
  const radiusKm =
    req.query.radiusKm != null ? Number(req.query.radiusKm) : 50;

  const params: unknown[] = [];
  const where: string[] = [
    `status = 'approved'`,
    `NOT EXISTS (SELECT 1 FROM users u WHERE u.id = garages.owner_id AND u.status = 'suspended')`,
  ];

  if (q) {
    params.push(`%${q}%`);
    const likeIdx = params.length;
    params.push(matchingCategoryIds(q));
    const catIdx = params.length;
    where.push(
      `(name ILIKE $${likeIdx} OR description ILIKE $${likeIdx} OR address ILIKE $${likeIdx} OR city ILIKE $${likeIdx} OR EXISTS (SELECT 1 FROM unnest(services) AS s WHERE s ILIKE $${likeIdx}) OR categories && $${catIdx}::text[])`
    );
  }
  if (city) {
    params.push(city);
    where.push(`city ILIKE $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`$${params.length} = ANY(categories)`);
  }
  if (service) {
    params.push(service);
    where.push(
      `EXISTS (SELECT 1 FROM unnest(services) AS s WHERE lower(s) = lower($${params.length}))`
    );
  }

  let distanceSelect = '';
  let orderBy = 'name ASC';

  if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    params.push(lat, lng);
    const latIdx = params.length - 1;
    const lngIdx = params.length;
    distanceSelect = `,
      (6371 * acos(
        cos(radians($${latIdx})) * cos(radians(latitude)) *
        cos(radians(longitude) - radians($${lngIdx})) +
        sin(radians($${latIdx})) * sin(radians(latitude))
      )) AS distance_km`;
    params.push(radiusKm);
    where.push(`
      (6371 * acos(
        cos(radians($${latIdx})) * cos(radians(latitude)) *
        cos(radians(longitude) - radians($${lngIdx})) +
        sin(radians($${latIdx})) * sin(radians(latitude))
      )) <= $${params.length}
    `);
    orderBy = 'distance_km ASC';
  }

  // Meilleure visibilité : les offres « boost » passent en tête
  params.push(await boostedPlans());
  const boostIdx = params.length;

  const sql = `
    SELECT * ${RATING_SELECT} ${distanceSelect}
    FROM garages
    WHERE ${where.join(' AND ')}
    ORDER BY (${effectivePlanSql()} = ANY($${boostIdx}::text[])) DESC, ${orderBy}
    LIMIT 200
  `;

  const { rows } = await query<GarageRow>(sql, params);

  // Statistique « apparitions en recherche » (uniquement les vraies recherches)
  if (q && rows.length > 0) {
    const ids = rows.slice(0, 20).map((r) => r.id);
    query(
      `INSERT INTO garage_stats_daily (garage_id, day, searches)
       SELECT unnest($1::uuid[]), CURRENT_DATE, 1
       ON CONFLICT (garage_id, day)
       DO UPDATE SET searches = garage_stats_daily.searches + 1`,
      [ids]
    ).catch(() => {});
  }

  res.setHeader('X-Sync-Time', new Date().toISOString());
  return res.json({
    syncedAt: new Date().toISOString(),
    offline: false,
    garages: await Promise.all(rows.map((r) => withPlan(mapGarage(r), { public: true }))),
  });
});

/** Garages du propriétaire connecté (avec stats) */
router.get('/mine/list', requireGarageAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query<GarageRow>(
    `SELECT * ${RATING_SELECT} FROM garages WHERE owner_id = $1 ORDER BY created_at DESC`,
    [req.user!.id]
  );
  return res.json(await Promise.all(rows.map((r) => withPlan(mapGarage(r), { public: false }))));
});

router.get('/:id', async (req, res) => {
  const { rows } = await query<GarageRow>(
    `SELECT * ${RATING_SELECT} FROM garages WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Garage introuvable' });
  return res.json(await withPlan(mapGarage(rows[0]), { public: true }));
});

/** Le garagiste demande à passer à une autre offre (activée par le super admin après paiement). */
router.post('/:id/plan-request', requireGarageAuth, async (req: AuthedRequest, res) => {
  const { plan } = req.body as { plan?: string };
  if (!isPlanId(plan)) return res.status(400).json({ error: 'Offre invalide' });
  const { rows } = await query<GarageRow & { owner_email: string; owner_name: string }>(
    `SELECT g.*, u.email AS owner_email, u.full_name AS owner_name
     FROM garages g JOIN users u ON u.id = g.owner_id WHERE g.id = $1`,
    [req.params.id]
  );
  const g = rows[0];
  if (!g) return res.status(404).json({ error: 'Garage introuvable' });
  if (g.owner_id !== req.user!.id) return res.status(403).json({ error: 'Non autorisé' });

  const updated = await query<GarageRow>(
    `UPDATE garages SET plan_request = $2, plan_requested_at = NOW() WHERE id = $1 RETURNING *`,
    [g.id, plan]
  );
  const { plans } = (await getConfig()).config;
  sendAdminNotice({
    subject: `Demande d’offre ${plans[plan].name.fr}`,
    intro: 'Un garagiste demande à changer d’offre. Active-la depuis le site super admin après réception du paiement.',
    details: {
      Garage: g.name,
      'Offre actuelle': plans[effectivePlan(g.plan, g.plan_expires_at)].name.fr,
      'Offre demandée': `${plans[plan].name.fr} (${plans[plan].price.toLocaleString('fr-FR')} Ar/mois)`,
      Propriétaire: `${g.owner_name} (${g.owner_email})`,
      Téléphone: g.phone || '—',
    },
  }).catch(() => {});
  return res.json(await withPlan(mapGarage(updated.rows[0]), { public: false }));
});

router.delete('/:id/plan-request', requireGarageAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query<GarageRow>(
    `UPDATE garages SET plan_request = NULL, plan_requested_at = NULL
     WHERE id = $1 AND owner_id = $2 RETURNING *`,
    [req.params.id, req.user!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Garage introuvable' });
  return res.json(await withPlan(mapGarage(rows[0]), { public: false }));
});

/** Compteurs de statistiques (vue de fiche / appel) */
router.post('/:id/track/:kind', async (req, res) => {
  const kind = req.params.kind === 'call' ? 'calls' : 'views';
  await query(`UPDATE garages SET ${kind} = ${kind} + 1 WHERE id = $1`, [
    req.params.id,
  ]);
  // Agrégat journalier pour le graphique
  query(
    `INSERT INTO garage_stats_daily (garage_id, day, ${kind})
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (garage_id, day)
     DO UPDATE SET ${kind} = garage_stats_daily.${kind} + 1`,
    [req.params.id]
  ).catch(() => {});
  return res.status(204).end();
});

/** Statistiques journalières (propriétaire uniquement) */
router.get(
  '/:id/stats/daily',
  requireGarageAuth,
  async (req: AuthedRequest, res) => {
    const owner = await query<{ owner_id: string }>(
      `SELECT owner_id FROM garages WHERE id = $1`,
      [req.params.id]
    );
    if (!owner.rows[0]) {
      return res.status(404).json({ error: 'Garage introuvable' });
    }
    if (owner.rows[0].owner_id !== req.user!.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const days = Math.min(Number(req.query.days) || 7, 30);
    const { rows } = await query<{
      day: string;
      views: number;
      calls: number;
      searches: number;
    }>(
      `SELECT gs.day::date::text AS day,
              COALESCE(d.views, 0) AS views,
              COALESCE(d.calls, 0) AS calls,
              COALESCE(d.searches, 0) AS searches
       FROM generate_series(
         CURRENT_DATE - ($2::int - 1), CURRENT_DATE, interval '1 day'
       ) AS gs(day)
       LEFT JOIN garage_stats_daily d
         ON d.garage_id = $1 AND d.day = gs.day::date
       ORDER BY gs.day ASC`,
      [req.params.id, days]
    );
    return res.json(
      rows.map((r) => ({
        day: r.day,
        views: Number(r.views ?? 0),
        calls: Number(r.calls ?? 0),
        searches: Number(r.searches ?? 0),
      }))
    );
  }
);

/** Avis */
router.get('/:id/reviews', async (req, res) => {
  const features = await garageFeatures(req.params.id);
  if (!features?.reviews) return res.json([]);
  const { rows } = await query(
    `SELECT id, author_name, rating, comment, created_at
     FROM reviews WHERE garage_id = $1
     ORDER BY created_at DESC LIMIT 100`,
    [req.params.id]
  );
  return res.json(
    (rows as {
      id: string;
      author_name: string;
      rating: number;
      comment: string;
      created_at: string;
    }[]).map((r) => ({
      id: r.id,
      authorName: r.author_name,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    }))
  );
});

router.post('/:id/reviews', async (req, res) => {
  const { authorName, rating, comment = '' } = req.body as {
    authorName?: string;
    rating?: number;
    comment?: string;
  };
  if (!authorName?.trim() || !rating || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ error: 'authorName et rating (1-5) requis' });
  }
  const features = await garageFeatures(req.params.id);
  if (!features?.reviews) {
    return res.status(403).json({ error: 'Les avis ne sont pas disponibles pour ce garage' });
  }
  const { rows } = await query(
    `INSERT INTO reviews (garage_id, author_name, rating, comment)
     VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
    [req.params.id, authorName.trim(), Math.round(rating), comment.trim()]
  );
  return res.status(201).json(rows[0]);
});

type CreateResult = { status: number; body: unknown };

/** Le garage est validé : un compte encore en attente l'est aussi (une seule validation). */
export async function approveOwnerOf(garageId: string) {
  await query(
    `UPDATE users SET status = 'approved', approval_token = NULL
     WHERE id = (SELECT owner_id FROM garages WHERE id = $1) AND status = 'pending'`,
    [garageId]
  );
}

/** Contrôles du formulaire garage, sans écrire en base (utilisé avant de créer le compte). */
export async function validateGarageInput(b: Record<string, any>): Promise<string | null> {
  if (!b?.name?.trim?.() || !b?.address?.trim?.() || b.latitude == null || b.longitude == null) {
    return 'Nom, adresse et localisation du garage requis';
  }
  if (!Number.isFinite(Number(b.latitude)) || !Number.isFinite(Number(b.longitude))) {
    return 'Localisation invalide';
  }
  const { config: appConfig } = await getConfig();
  const categories = resolveCategories(b.categories ?? [], b.services ?? []);
  return checkGarageForm(appConfig, {
    phone: b.phone,
    city: b.city,
    description: b.description,
    photos: b.photos ?? [],
    categories,
  });
}

/** Crée le garage d'un compte (1 compte = 1 garage). */
export async function createGarageForOwner(ownerId: string, b: Record<string, any>): Promise<CreateResult> {
  const {
    name,
    description = '',
    address,
    city = '',
    phone = '',
    latitude,
    longitude,
    categories: rawCategories = [],
    services: rawServices = [],
    photos = [],
    mobileService = false,
    promo = '',
    priceList = [],
    openingHours = 'Lun–Sam 8h–18h',
    hoursJson = null,
    isOpen = true,
  } = b;

  const inputError = await validateGarageInput(b);
  if (inputError) return { status: 400, body: { error: inputError } };

  const owner = await query<{ status: string; email: string; full_name: string }>(
    `SELECT status, email, full_name FROM users WHERE id = $1`,
    [ownerId]
  );
  if (!owner.rows[0] || owner.rows[0].status === 'suspended') {
    return { status: 403, body: { error: 'Compte suspendu par l’administrateur' } };
  }
  const ownerPending = owner.rows[0].status === 'pending';

  const existing = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM garages WHERE owner_id = $1`,
    [ownerId]
  );
  if (Number(existing.rows[0].count) >= 1) {
    return {
      status: 409,
      body: { error: 'Un seul garage par compte. Modifie ta fiche existante au lieu d’en créer une nouvelle.' },
    };
  }

  const { config: appConfig } = await getConfig();
  const categories = resolveCategories(rawCategories, rawServices);
  const services = servicesForCategory(categories, rawServices);

  // Compte en attente : la validation du garage validera aussi le compte
  const needsApproval = appConfig.approval.garages || ownerPending;
  const approvalToken = needsApproval ? crypto.randomUUID() : null;

  const { rows } = await query<GarageRow>(
    `INSERT INTO garages
      (owner_id, name, description, address, city, phone, latitude, longitude,
       services, photos, mobile_service, promo, price_list, opening_hours,
       hours_json, is_open, status, approval_token, categories)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [
      ownerId,
      String(name).trim(),
      description,
      String(address).trim(),
      city,
      phone,
      Number(latitude),
      Number(longitude),
      services,
      photos,
      mobileService,
      promo,
      JSON.stringify(priceList),
      openingHours,
      hoursJson ? JSON.stringify(hoursJson) : null,
      isOpen,
      needsApproval ? 'pending' : 'approved',
      approvalToken,
      categories,
    ]
  );

  if (approvalToken) {
    await sendAdminValidationEmail({
      subject: ownerPending ? 'Nouveau garagiste à valider' : 'Nouveau garage à valider',
      intro: ownerPending
        ? 'Un nouveau garagiste vient de s’inscrire avec son garage. Valider le garage valide aussi son compte.'
        : 'Un nouveau garage vient d’être publié sur Mekano et attend ta validation avant d’être visible par les clients.',
      details: {
        Garage: name,
        Adresse: `${address}${city ? `, ${city}` : ''}`,
        'Téléphone': phone || '—',
        'Type de service': categories.map(categoryLabel).join(', ') || '—',
        'Sous-types': services.join(', ') || '—',
        'Propriétaire': `${owner.rows[0].full_name} (${owner.rows[0].email})`,
      },
      approveUrl: `${config.publicUrl}/api/admin/garages/${approvalToken}/approve`,
      rejectUrl: `${config.publicUrl}/api/admin/garages/${approvalToken}/reject`,
    });
  }

  return { status: 201, body: await withPlan(mapGarage(rows[0]), { public: false }) };
}

router.post('/', requireGarageAuth, async (req: AuthedRequest, res) => {
  const result = await createGarageForOwner(req.user!.id, req.body ?? {});
  return res.status(result.status).json(result.body);
});

router.put('/:id', requireGarageAuth, async (req: AuthedRequest, res) => {
  const existing = await query<GarageRow>(
    `SELECT * FROM garages WHERE id = $1`,
    [req.params.id]
  );
  if (!existing.rows[0]) {
    return res.status(404).json({ error: 'Garage introuvable' });
  }
  if (existing.rows[0].owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  const g = existing.rows[0];
  const b = req.body;
  const categories =
    b.categories !== undefined || b.services !== undefined
      ? resolveCategories(b.categories ?? g.categories, b.services ?? g.services)
      : g.categories;
  const services = servicesForCategory(categories, b.services ?? g.services);

  const { rows } = await query<GarageRow>(
    `UPDATE garages SET
      name = $1, description = $2, address = $3, city = $4, phone = $5,
      latitude = $6, longitude = $7, services = $8, photos = $9,
      mobile_service = $10, promo = $11, price_list = $12,
      opening_hours = $13, hours_json = $14, is_open = $15,
      categories = $17, updated_at = NOW()
     WHERE id = $16
     RETURNING *`,
    [
      b.name ?? g.name,
      b.description ?? g.description,
      b.address ?? g.address,
      b.city ?? g.city,
      b.phone ?? g.phone,
      b.latitude ?? g.latitude,
      b.longitude ?? g.longitude,
      services,
      b.photos ?? g.photos,
      b.mobileService ?? g.mobile_service,
      b.promo ?? g.promo,
      JSON.stringify(b.priceList ?? g.price_list),
      b.openingHours ?? g.opening_hours,
      b.hoursJson !== undefined
        ? b.hoursJson
          ? JSON.stringify(b.hoursJson)
          : null
        : g.hours_json
          ? JSON.stringify(g.hours_json)
          : null,
      b.isOpen ?? g.is_open,
      req.params.id,
      categories,
    ]
  );
  return res.json(await withPlan(mapGarage(rows[0]), { public: false }));
});

router.delete('/:id', requireGarageAuth, async (req: AuthedRequest, res) => {
  const existing = await query<GarageRow>(
    `SELECT * FROM garages WHERE id = $1`,
    [req.params.id]
  );
  if (!existing.rows[0]) {
    return res.status(404).json({ error: 'Garage introuvable' });
  }
  if (existing.rows[0].owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  await query(`DELETE FROM garages WHERE id = $1`, [req.params.id]);
  return res.status(204).end();
});

export default router;
