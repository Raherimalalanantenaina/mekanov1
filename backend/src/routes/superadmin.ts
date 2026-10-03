import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { config } from '../config';
import { requireSuperAdmin, SuperAdminRequest } from '../middleware/auth';
import { getConfig, getLogoVersion, saveConfig, saveLogo } from '../appSettings';
import {
  getFullCatalog,
  isCategoryIcon,
  loadCatalog,
  normalize,
  resolveCategories,
  servicesForCategory,
  slugify,
} from '../serviceCatalog';
import { pushBroadcast, pushToUser } from '../push';
import { approveOwnerOf, GarageRow, mapGarage, RATING_SELECT } from './garages';
import { effectivePlanSql, isPlanId } from '../plans';

const router = Router();

/** Express 4 ne capture pas les rejets de promesse : on les renvoie à next(). */
const h =
  (fn: (req: SuperAdminRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req as SuperAdminRequest, res).catch(next);

// ─── Connexion ──────────────────────────────────────────────────────────────

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const LOCK_MS = 15 * 60 * 1000;

function sameSecret(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

router.post(
  '/login',
  h(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!config.superAdmin.email || !config.superAdmin.password) {
      return res.status(503).json({
        error:
          'Super admin non configuré : définis SUPERADMIN_EMAIL et SUPERADMIN_PASSWORD sur le serveur.',
      });
    }
    const ip = req.ip ?? 'unknown';
    const entry = attempts.get(ip);
    if (entry && entry.count >= MAX_ATTEMPTS && entry.until > Date.now()) {
      return res
        .status(429)
        .json({ error: 'Trop de tentatives. Réessaie dans 15 minutes.' });
    }
    const ok =
      sameSecret((email ?? '').toLowerCase().trim(), config.superAdmin.email) &&
      sameSecret(password ?? '', config.superAdmin.password);
    if (!ok) {
      const count = entry && entry.until > Date.now() ? entry.count + 1 : 1;
      attempts.set(ip, { count, until: Date.now() + LOCK_MS });
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    attempts.delete(ip);
    const token = jwt.sign(
      { role: 'superadmin', email: config.superAdmin.email },
      config.jwtSecret,
      { expiresIn: '12h' }
    );
    return res.json({ token, email: config.superAdmin.email });
  })
);

router.use(requireSuperAdmin);

router.get(
  '/me',
  h(async (req, res) => res.json({ email: req.admin!.email }))
);

// ─── Tableau de bord ────────────────────────────────────────────────────────

router.get(
  '/stats',
  h(async (_req, res) => {
    const totals = await query<Record<string, string>>(`
      SELECT
        (SELECT COUNT(*) FROM garages) AS garages_total,
        (SELECT COUNT(*) FROM garages WHERE status = 'pending') AS garages_pending,
        (SELECT COUNT(*) FROM garages WHERE status = 'approved') AS garages_approved,
        (SELECT COUNT(*) FROM garages WHERE status = 'hidden') AS garages_hidden,
        (SELECT COUNT(*) FROM garages WHERE plan_request IS NOT NULL) AS plan_requests,
        (SELECT COUNT(*) FROM users) AS users_total,
        (SELECT COUNT(*) FROM users WHERE status = 'pending') AS users_pending,
        (SELECT COUNT(*) FROM users WHERE status = 'suspended') AS users_suspended,
        (SELECT COUNT(*) FROM reviews) AS reviews,
        (SELECT COUNT(*) FROM quote_requests) AS quotes,
        (SELECT COUNT(*) FROM appointments) AS appointments,
        (SELECT COUNT(*) FROM push_tokens) AS devices,
        (SELECT COALESCE(SUM(views), 0) FROM garages) AS views,
        (SELECT COALESCE(SUM(calls), 0) FROM garages) AS calls
    `);
    const daily = await query<{ day: string; views: string; calls: string; searches: string }>(`
      SELECT gs.day::date::text AS day,
             COALESCE(SUM(d.views), 0) AS views,
             COALESCE(SUM(d.calls), 0) AS calls,
             COALESCE(SUM(d.searches), 0) AS searches
      FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') AS gs(day)
      LEFT JOIN garage_stats_daily d ON d.day = gs.day::date
      GROUP BY gs.day ORDER BY gs.day
    `);
    const top = await query<{ id: string; name: string; city: string; views: number; calls: number }>(
      `SELECT id, name, city, views, calls FROM garages
       ORDER BY views DESC, calls DESC LIMIT 5`
    );
    const byCategory = await query<{ id: string; count: string }>(
      `SELECT unnest(categories) AS id, COUNT(*) AS count
       FROM garages WHERE status = 'approved' GROUP BY 1`
    );
    const byPlan = await query<{ id: string; count: string }>(
      `SELECT ${effectivePlanSql()} AS id, COUNT(*) AS count FROM garages GROUP BY 1`
    );
    const t = totals.rows[0];
    return res.json({
      byPlan: byPlan.rows.map((r) => ({ id: r.id, count: Number(r.count) })),
      totals: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Number(v)])),
      daily: daily.rows.map((d) => ({
        day: d.day,
        views: Number(d.views),
        calls: Number(d.calls),
        searches: Number(d.searches),
      })),
      top: top.rows,
      byCategory: byCategory.rows.map((r) => ({ id: r.id, count: Number(r.count) })),
    });
  })
);

// ─── Notifications du back-office ───────────────────────────────────────────

/** Tâches à traiter (inscriptions, demandes d'offre, comptes) + avis récents. */
router.get(
  '/notifications',
  h(async (_req, res) => {
    const { rows } = await query<{
      kind: string;
      id: string;
      title: string;
      detail: string | null;
      at: string;
    }>(`
      (SELECT 'registration' AS kind, g.id, g.name AS title, u.full_name AS detail, g.created_at AS at
         FROM garages g JOIN users u ON u.id = g.owner_id
        WHERE g.status = 'pending')
      UNION ALL
      (SELECT 'plan_request', g.id, g.name, g.plan_request, COALESCE(g.plan_requested_at, g.created_at)
         FROM garages g WHERE g.plan_request IS NOT NULL)
      UNION ALL
      (SELECT 'account', u.id, u.full_name, u.email, u.created_at
         FROM users u LEFT JOIN garages g ON g.owner_id = u.id
        WHERE u.status = 'pending' AND g.id IS NULL)
      UNION ALL
      (SELECT 'review', r.id, g.name, r.author_name || ' · ' || r.rating || '/5', r.created_at
         FROM reviews r JOIN garages g ON g.id = r.garage_id
        WHERE r.created_at > NOW() - INTERVAL '7 days')
      ORDER BY at DESC
      LIMIT 50
    `);
    return res.json(rows);
  })
);

// ─── Catalogue des types de service ─────────────────────────────────────────

function cleanKeywords(v: unknown): string[] {
  const list: unknown[] = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return [
    ...new Set(
      list
        .filter((k): k is string => typeof k === 'string')
        .map((k) => normalize(k))
        .filter(Boolean)
    ),
  ];
}

router.get('/catalog', h(async (_req, res) => res.json(getFullCatalog())));

router.post(
  '/catalog/categories',
  h(async (req, res) => {
    const { label, labelMg = '', icon, keywords, active = true } = req.body as {
      label?: string;
      labelMg?: string;
      icon?: string;
      keywords?: unknown;
      active?: boolean;
    };
    if (!label?.trim()) return res.status(400).json({ error: 'Libellé requis' });
    let id = slugify(label);
    const taken = new Set(getFullCatalog().map((c) => c.id));
    for (let i = 2; taken.has(id); i++) id = `${slugify(label)}-${i}`;
    await query(
      `INSERT INTO service_categories (id, icon, label_fr, label_mg, keywords, position, active)
       VALUES ($1,$2,$3,$4,$5,
         (SELECT COALESCE(MAX(position), -1) + 1 FROM service_categories), $6)`,
      [
        id,
        isCategoryIcon(icon) ? icon : 'wrench',
        label.trim(),
        labelMg.trim(),
        cleanKeywords(keywords),
        Boolean(active),
      ]
    );
    await loadCatalog();
    return res.status(201).json(getFullCatalog().find((c) => c.id === id));
  })
);

router.put(
  '/catalog/order',
  h(async (req, res) => {
    const ids = (req.body.ids ?? []) as string[];
    for (const [i, id] of ids.entries()) {
      await query(`UPDATE service_categories SET position = $2 WHERE id = $1`, [id, i]);
    }
    await loadCatalog();
    return res.json(getFullCatalog());
  })
);

router.put(
  '/catalog/categories/:id',
  h(async (req, res) => {
    const cat = getFullCatalog().find((c) => c.id === req.params.id);
    if (!cat) return res.status(404).json({ error: 'Type introuvable' });
    const b = req.body as {
      icon?: string;
      label?: string;
      labelMg?: string;
      keywords?: unknown;
      active?: boolean;
    };
    await query(
      `UPDATE service_categories
       SET icon = $2, label_fr = $3, label_mg = $4, keywords = $5, active = $6
       WHERE id = $1`,
      [
        cat.id,
        isCategoryIcon(b.icon) ? b.icon : cat.icon,
        b.label?.trim() || cat.label,
        b.labelMg !== undefined ? String(b.labelMg).trim() : cat.labelMg,
        b.keywords !== undefined ? cleanKeywords(b.keywords) : cat.keywords,
        b.active ?? cat.active,
      ]
    );
    await loadCatalog();
    return res.json(getFullCatalog().find((c) => c.id === cat.id));
  })
);

router.delete(
  '/catalog/categories/:id',
  h(async (req, res) => {
    const cat = getFullCatalog().find((c) => c.id === req.params.id);
    if (!cat) return res.status(404).json({ error: 'Type introuvable' });
    // Retire le type et ses sous-types des fiches garage
    await query(
      `UPDATE garages SET
         categories = array_remove(categories, $1),
         services = ARRAY(SELECT s FROM unnest(services) AS s WHERE s <> ALL($2::text[]))
       WHERE $1 = ANY(categories) OR services && $2::text[]`,
      [cat.id, cat.subtypes.map((s) => s.label)]
    );
    await query(`DELETE FROM service_categories WHERE id = $1`, [cat.id]);
    await loadCatalog();
    return res.status(204).end();
  })
);

router.post(
  '/catalog/categories/:id/subtypes',
  h(async (req, res) => {
    const { label, labelMg = '', active = true } = req.body as {
      label?: string;
      labelMg?: string;
      active?: boolean;
    };
    if (!label?.trim()) return res.status(400).json({ error: 'Libellé requis' });
    const cat = getFullCatalog().find((c) => c.id === req.params.id);
    if (!cat) return res.status(404).json({ error: 'Type introuvable' });
    await query(
      `INSERT INTO service_subtypes (category_id, label_fr, label_mg, position, active)
       VALUES ($1,$2,$3,
         (SELECT COALESCE(MAX(position), -1) + 1 FROM service_subtypes WHERE category_id = $1), $4)`,
      [cat.id, label.trim(), labelMg.trim(), Boolean(active)]
    );
    await loadCatalog();
    return res.status(201).json(getFullCatalog().find((c) => c.id === cat.id));
  })
);

router.put(
  '/catalog/categories/:id/subtypes/order',
  h(async (req, res) => {
    const ids = (req.body.ids ?? []) as string[];
    for (const [i, id] of ids.entries()) {
      await query(
        `UPDATE service_subtypes SET position = $3 WHERE id = $1 AND category_id = $2`,
        [id, req.params.id, i]
      );
    }
    await loadCatalog();
    return res.json(getFullCatalog());
  })
);

router.put(
  '/catalog/subtypes/:id',
  h(async (req, res) => {
    const { rows } = await query<{ label_fr: string; label_mg: string; active: boolean }>(
      `SELECT label_fr, label_mg, active FROM service_subtypes WHERE id = $1`,
      [req.params.id]
    );
    const sub = rows[0];
    if (!sub) return res.status(404).json({ error: 'Sous-type introuvable' });
    const b = req.body as { label?: string; labelMg?: string; active?: boolean };
    const label = b.label?.trim() || sub.label_fr;
    await query(
      `UPDATE service_subtypes SET label_fr = $2, label_mg = $3, active = $4 WHERE id = $1`,
      [
        req.params.id,
        label,
        b.labelMg !== undefined ? String(b.labelMg).trim() : sub.label_mg,
        b.active ?? sub.active,
      ]
    );
    // Les garages stockent le libellé : on le renomme partout
    if (label !== sub.label_fr) {
      await query(
        `UPDATE garages SET services = array_replace(services, $1, $2) WHERE $1 = ANY(services)`,
        [sub.label_fr, label]
      );
    }
    await loadCatalog();
    return res.json(getFullCatalog());
  })
);

router.delete(
  '/catalog/subtypes/:id',
  h(async (req, res) => {
    const { rows } = await query<{ label_fr: string }>(
      `DELETE FROM service_subtypes WHERE id = $1 RETURNING label_fr`,
      [req.params.id]
    );
    if (rows[0]) {
      await query(
        `UPDATE garages SET services = array_remove(services, $1) WHERE $1 = ANY(services)`,
        [rows[0].label_fr]
      );
    }
    await loadCatalog();
    return res.status(204).end();
  })
);

// ─── Configuration de l'app ─────────────────────────────────────────────────

router.get(
  '/config',
  h(async (_req, res) => {
    const { config: appConfig } = await getConfig();
    const logoVersion = await getLogoVersion();
    return res.json({
      config: appConfig,
      logoUrl: logoVersion ? `/api/config/logo?v=${logoVersion}` : null,
    });
  })
);

router.put(
  '/config',
  h(async (req, res) => res.json({ config: await saveConfig(req.body) }))
);

router.put(
  '/config/logo',
  h(async (req, res) => {
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl || !/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(dataUrl)) {
      return res.status(400).json({ error: 'Image PNG, JPEG, WEBP ou SVG requise' });
    }
    if (dataUrl.length > 2_000_000) {
      return res.status(413).json({ error: 'Logo trop lourd (1,5 Mo maximum)' });
    }
    await saveLogo(dataUrl);
    const v = await getLogoVersion();
    return res.json({ logoUrl: `/api/config/logo?v=${v}` });
  })
);

router.delete(
  '/config/logo',
  h(async (_req, res) => {
    await saveLogo(null);
    return res.status(204).end();
  })
);

// ─── Garages ────────────────────────────────────────────────────────────────

const GARAGE_STATUSES = ['pending', 'approved', 'hidden'];

router.get(
  '/garages',
  h(async (req, res) => {
    const params: unknown[] = [];
    const where: string[] = [];
    const status = String(req.query.status || '');
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '');
    if (GARAGE_STATUSES.includes(status)) {
      params.push(status);
      where.push(`g.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(g.name ILIKE $${params.length} OR g.city ILIKE $${params.length} OR g.address ILIKE $${params.length} OR u.email ILIKE $${params.length} OR g.phone ILIKE $${params.length})`
      );
    }
    if (category) {
      params.push(category);
      where.push(`$${params.length} = ANY(g.categories)`);
    }
    const plan = String(req.query.plan || '');
    if (isPlanId(plan)) {
      params.push(plan);
      where.push(`${effectivePlanSql('g')} = $${params.length}`);
    }
    if (req.query.planRequest === '1') where.push(`g.plan_request IS NOT NULL`);
    const { rows } = await query<{
      id: string;
      owner_id: string;
      name: string;
      address: string;
      city: string;
      phone: string;
      categories: string[] | null;
      services: string[] | null;
      status: string;
      is_open: boolean;
      views: number;
      calls: number;
      created_at: string;
      photo_count: number | null;
      owner_email: string;
      owner_name: string;
      owner_status: string;
      rating: string | null;
      plan: string;
      plan_expires_at: string | null;
      plan_request: string | null;
      plan_requested_at: string | null;
    }>(
      `SELECT g.id, g.owner_id, g.name, g.address, g.city, g.phone, g.categories,
              g.services, g.status, g.is_open, g.views, g.calls, g.created_at,
              g.plan, g.plan_expires_at, g.plan_request, g.plan_requested_at,
              cardinality(g.photos) AS photo_count,
              u.email AS owner_email, u.full_name AS owner_name, u.status AS owner_status,
              (SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.garage_id = g.id) AS rating
       FROM garages g JOIN users u ON u.id = g.owner_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY (g.status = 'pending') DESC, (g.plan_request IS NOT NULL) DESC, g.created_at DESC
       LIMIT 500`,
      params
    );
    return res.json(
      rows.map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        name: r.name,
        address: r.address,
        city: r.city,
        phone: r.phone,
        categories: r.categories ?? [],
        services: r.services ?? [],
        status: r.status,
        isOpen: r.is_open,
        views: r.views,
        calls: r.calls,
        createdAt: r.created_at,
        photoCount: Number(r.photo_count ?? 0),
        ownerEmail: r.owner_email,
        ownerName: r.owner_name,
        ownerStatus: r.owner_status,
        rating: r.rating != null ? Number(r.rating) : null,
        ...planInfo(r),
      }))
    );
  })
);

router.get(
  '/garages/:id',
  h(async (req, res) => {
    const { rows } = await query<GarageRow & { owner_email: string; owner_name: string }>(
      `SELECT garages.* ${RATING_SELECT}, u.email AS owner_email, u.full_name AS owner_name
       FROM garages JOIN users u ON u.id = garages.owner_id
       WHERE garages.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Garage introuvable' });
    return res.json({
      ...mapGarage(rows[0]),
      ...planInfo(rows[0]),
      ownerEmail: rows[0].owner_email,
      ownerName: rows[0].owner_name,
    });
  })
);

function planInfo(r: {
  plan: string;
  plan_expires_at: string | null;
  plan_request: string | null;
  plan_requested_at: string | null;
}) {
  const expired = !!r.plan_expires_at && new Date(r.plan_expires_at).getTime() < Date.now();
  return {
    plan: isPlanId(r.plan) && !expired ? r.plan : 'free',
    /** Offre enregistrée (même expirée), pour la renouveler facilement */
    paidPlan: isPlanId(r.plan) ? r.plan : 'free',
    planExpiresAt: r.plan_expires_at,
    planExpired: expired,
    planRequest: isPlanId(r.plan_request) ? r.plan_request : null,
    planRequestedAt: r.plan_requested_at,
  };
}

/** Valide `plan` / `planExpiresAt` envoyés par le site admin. */
function readPlan(b: Record<string, any>): { plan?: string; expiresAt?: string | null } | string {
  const out: { plan?: string; expiresAt?: string | null } = {};
  if (b.plan !== undefined) {
    if (!isPlanId(b.plan)) return 'Offre invalide';
    out.plan = b.plan;
  }
  if (b.planExpiresAt !== undefined) {
    if (b.planExpiresAt === null || b.planExpiresAt === '') out.expiresAt = null;
    else {
      const d = new Date(b.planExpiresAt);
      if (Number.isNaN(d.getTime())) return 'Date de fin d’offre invalide';
      out.expiresAt = d.toISOString();
    }
  }
  return out;
}

type AccountInput = { email?: string; fullName?: string; password?: string; status?: string };

/** Crée un compte garagiste (déjà validé par défaut). */
async function createAccount(b: AccountInput): Promise<string> {
  if (!b.email?.trim() || !b.fullName?.trim() || !b.password || b.password.length < 6) {
    throw Object.assign(new Error('Email, nom et mot de passe (6 caractères min.) requis'), {
      status: 400,
    });
  }
  const hash = await bcrypt.hash(b.password, 10);
  try {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ($1,$2,$3,'garage',$4) RETURNING id`,
      [
        b.email.toLowerCase().trim(),
        hash,
        b.fullName.trim(),
        ['pending', 'approved', 'suspended'].includes(b.status ?? '') ? b.status : 'approved',
      ]
    );
    return rows[0].id;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw Object.assign(new Error('Email déjà utilisé'), { status: 409 });
    }
    throw err;
  }
}

function sendError(res: Response, err: unknown) {
  const status = (err as { status?: number }).status;
  if (status) return res.status(status).json({ error: (err as Error).message });
  throw err;
}

router.post(
  '/garages',
  h(async (req, res) => {
    const b = req.body as Record<string, any>;
    if (!b.name?.trim() || !b.address?.trim() || b.latitude == null || b.longitude == null) {
      return res.status(400).json({ error: 'Nom, adresse, latitude et longitude requis' });
    }
    const planInput = readPlan(b);
    if (typeof planInput === 'string') return res.status(400).json({ error: planInput });
    let ownerId: string | undefined = b.ownerId;
    try {
      if (!ownerId) ownerId = await createAccount(b.owner ?? {});
    } catch (err) {
      return sendError(res, err);
    }
    const existing = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM garages WHERE owner_id = $1`,
      [ownerId]
    );
    if (Number(existing.rows[0].count) >= 1) {
      return res.status(409).json({ error: 'Ce compte a déjà un garage (1 compte = 1 garage)' });
    }
    const categories = resolveCategories(b.categories, b.services);
    const services = servicesForCategory(categories, b.services);
    const { rows } = await query<GarageRow>(
      `INSERT INTO garages
        (owner_id, name, description, address, city, phone, latitude, longitude,
         services, categories, photos, mobile_service, promo, price_list,
         opening_hours, hours_json, is_open, status, plan, plan_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        ownerId,
        b.name.trim(),
        b.description ?? '',
        b.address.trim(),
        b.city ?? '',
        b.phone ?? '',
        Number(b.latitude),
        Number(b.longitude),
        services,
        categories,
        Array.isArray(b.photos) ? b.photos : [],
        Boolean(b.mobileService),
        b.promo ?? '',
        JSON.stringify(Array.isArray(b.priceList) ? b.priceList : []),
        b.openingHours ?? 'Lun–Sam 8h–18h',
        b.hoursJson ? JSON.stringify(b.hoursJson) : null,
        b.isOpen ?? true,
        GARAGE_STATUSES.includes(b.status) ? b.status : 'approved',
        planInput.plan ?? 'free',
        planInput.expiresAt ?? null,
      ]
    );
    return res.status(201).json(mapGarage(rows[0]));
  })
);

/** Colonnes modifiables par le super admin : clé API → colonne SQL. */
const GARAGE_FIELDS: Record<string, string> = {
  name: 'name',
  description: 'description',
  address: 'address',
  city: 'city',
  phone: 'phone',
  latitude: 'latitude',
  longitude: 'longitude',
  services: 'services',
  photos: 'photos',
  mobileService: 'mobile_service',
  promo: 'promo',
  priceList: 'price_list',
  openingHours: 'opening_hours',
  hoursJson: 'hours_json',
  isOpen: 'is_open',
  status: 'status',
  ownerId: 'owner_id',
};

router.put(
  '/garages/:id',
  h(async (req, res) => {
    const current = await query<GarageRow & { status: string }>(
      `SELECT * FROM garages WHERE id = $1`,
      [req.params.id]
    );
    const g = current.rows[0];
    if (!g) return res.status(404).json({ error: 'Garage introuvable' });
    const b = req.body as Record<string, any>;
    if (b.status !== undefined && !GARAGE_STATUSES.includes(b.status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const planInput = readPlan(b);
    if (typeof planInput === 'string') return res.status(400).json({ error: planInput });
    const currentExpiry = g.plan_expires_at ? new Date(g.plan_expires_at).toISOString() : null;
    const planChanged =
      (planInput.plan !== undefined && planInput.plan !== g.plan) ||
      (planInput.expiresAt !== undefined && planInput.expiresAt !== currentExpiry);
    const sets: string[] = [];
    const params: unknown[] = [];
    if (planInput.plan !== undefined) {
      params.push(planInput.plan);
      sets.push(`plan = $${params.length}`);
    }
    if (planInput.expiresAt !== undefined) {
      params.push(planInput.expiresAt);
      sets.push(`plan_expires_at = $${params.length}`);
    }
    // Activer / renouveler une offre traite la demande en attente
    if (planChanged || b.clearPlanRequest === true) {
      sets.push(`plan_request = NULL`, `plan_requested_at = NULL`);
    }
    for (const [key, column] of Object.entries(GARAGE_FIELDS)) {
      if (b[key] === undefined || key === 'services') continue;
      let value = b[key];
      if (key === 'priceList' || key === 'hoursJson') {
        value = value == null ? null : JSON.stringify(value);
      }
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }
    if (b.categories !== undefined || b.services !== undefined) {
      const categories = resolveCategories(b.categories ?? g.categories, b.services ?? g.services);
      params.push(categories);
      sets.push(`categories = $${params.length}`);
      params.push(servicesForCategory(categories, b.services ?? g.services));
      sets.push(`services = $${params.length}`);
    }
    if (b.status && b.status !== 'pending') sets.push(`approval_token = NULL`);
    if (!sets.length) return res.json(mapGarage(g));
    params.push(req.params.id);
    const { rows } = await query<GarageRow>(
      `UPDATE garages SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (b.status === 'approved') await approveOwnerOf(g.id);
    if (b.status === 'approved' && g.status !== 'approved') {
      pushToUser(g.owner_id, {
        title: 'Garage validé',
        body: `${rows[0].name} est maintenant visible par les clients.`,
      }).catch(() => {});
    }
    if (planChanged && rows[0].plan !== 'free') {
      const { plans } = (await getConfig()).config;
      const name = plans[isPlanId(rows[0].plan) ? rows[0].plan : 'free'].name.fr;
      const until = rows[0].plan_expires_at
        ? ` jusqu’au ${new Date(rows[0].plan_expires_at).toLocaleDateString('fr-FR')}`
        : '';
      pushToUser(g.owner_id, {
        title: `Offre ${name} activée`,
        body: `${rows[0].name} profite de l’offre ${name}${until}.`,
      }).catch(() => {});
    }
    return res.json({ ...mapGarage(rows[0]), ...planInfo(rows[0]) });
  })
);

router.delete(
  '/garages/:id',
  h(async (req, res) => {
    await query(`DELETE FROM garages WHERE id = $1`, [req.params.id]);
    return res.status(204).end();
  })
);

// ─── Comptes garagistes ─────────────────────────────────────────────────────

const USER_STATUSES = ['pending', 'approved', 'suspended'];

router.get(
  '/users',
  h(async (req, res) => {
    const params: unknown[] = [];
    const where: string[] = [];
    const status = String(req.query.status || '');
    const q = String(req.query.q || '').trim();
    if (USER_STATUSES.includes(status)) {
      params.push(status);
      where.push(`u.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(u.email ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`);
    }
    const { rows } = await query<{
      id: string;
      email: string;
      full_name: string;
      status: string;
      created_at: string;
      garage_id: string | null;
      garage_name: string | null;
      garage_status: string | null;
    }>(
      `SELECT u.id, u.email, u.full_name, u.status, u.created_at,
              g.id AS garage_id, g.name AS garage_name, g.status AS garage_status
       FROM users u LEFT JOIN garages g ON g.owner_id = u.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY (u.status = 'pending') DESC, u.created_at DESC
       LIMIT 500`,
      params
    );
    return res.json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.full_name,
        status: r.status,
        createdAt: r.created_at,
        garageId: r.garage_id,
        garageName: r.garage_name,
        garageStatus: r.garage_status,
      }))
    );
  })
);

router.post(
  '/users',
  h(async (req, res) => {
    try {
      const id = await createAccount(req.body as AccountInput);
      return res.status(201).json({ id });
    } catch (err) {
      return sendError(res, err);
    }
  })
);

router.put(
  '/users/:id',
  h(async (req, res) => {
    const { rows } = await query<{ status: string; email: string; full_name: string }>(
      `SELECT status, email, full_name FROM users WHERE id = $1`,
      [req.params.id]
    );
    const u = rows[0];
    if (!u) return res.status(404).json({ error: 'Compte introuvable' });
    const b = req.body as { email?: string; fullName?: string; status?: string };
    if (b.status !== undefined && !USER_STATUSES.includes(b.status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const status = b.status ?? u.status;
    try {
      await query(
        `UPDATE users SET email = $2, full_name = $3, status = $4,
           approval_token = CASE WHEN $4 = 'pending' THEN approval_token ELSE NULL END
         WHERE id = $1`,
        [
          req.params.id,
          b.email?.toLowerCase().trim() || u.email,
          b.fullName?.trim() || u.full_name,
          status,
        ]
      );
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return res.status(409).json({ error: 'Email déjà utilisé' });
      }
      throw err;
    }
    if (status === 'approved' && u.status === 'pending') {
      pushToUser(req.params.id, {
        title: 'Compte validé',
        body: 'Tu peux maintenant publier ton garage.',
      }).catch(() => {});
    }
    return res.json({ ok: true });
  })
);

router.post(
  '/users/:id/password',
  h(async (req, res) => {
    const { password } = req.body as { password?: string };
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
    }
    const hash = await bcrypt.hash(password, 10);
    const r = await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
      req.params.id,
      hash,
    ]);
    if (!r.rowCount) return res.status(404).json({ error: 'Compte introuvable' });
    return res.json({ ok: true });
  })
);

router.delete(
  '/users/:id',
  h(async (req, res) => {
    await query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    return res.status(204).end();
  })
);

// ─── Modération ─────────────────────────────────────────────────────────────

router.get(
  '/reviews',
  h(async (_req, res) => {
    const { rows } = await query<{
      id: string;
      author_name: string;
      rating: number;
      comment: string;
      created_at: string;
      garage_id: string;
      garage_name: string;
    }>(
      `SELECT r.id, r.author_name, r.rating, r.comment, r.created_at,
              g.id AS garage_id, g.name AS garage_name
       FROM reviews r JOIN garages g ON g.id = r.garage_id
       ORDER BY r.created_at DESC LIMIT 300`
    );
    return res.json(
      rows.map((r) => ({
        id: r.id,
        authorName: r.author_name,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        garageId: r.garage_id,
        garageName: r.garage_name,
      }))
    );
  })
);

router.delete(
  '/reviews/:id',
  h(async (req, res) => {
    await query(`DELETE FROM reviews WHERE id = $1`, [req.params.id]);
    return res.status(204).end();
  })
);

router.get(
  '/quotes',
  h(async (_req, res) => {
    const { rows } = await query<{
      id: string;
      client_name: string;
      client_phone: string;
      description: string;
      status: string;
      created_at: string;
      garage_id: string;
      garage_name: string;
      message_count: string;
    }>(
      `SELECT q.id, q.client_name, q.client_phone, q.description, q.status, q.created_at,
              g.id AS garage_id, g.name AS garage_name,
              (SELECT COUNT(*) FROM quote_messages m WHERE m.request_id = q.id) AS message_count
       FROM quote_requests q JOIN garages g ON g.id = q.garage_id
       ORDER BY q.created_at DESC LIMIT 300`
    );
    return res.json(
      rows.map((r) => ({
        id: r.id,
        clientName: r.client_name,
        clientPhone: r.client_phone,
        description: r.description,
        status: r.status,
        createdAt: r.created_at,
        garageId: r.garage_id,
        garageName: r.garage_name,
        messageCount: Number(r.message_count),
      }))
    );
  })
);

router.get(
  '/quotes/:id/messages',
  h(async (req, res) => {
    const { rows } = await query<{
      id: string;
      sender: string;
      body: string;
      photo: string | null;
      created_at: string;
    }>(
      `SELECT id, sender, body, photo, created_at FROM quote_messages
       WHERE request_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    return res.json(
      rows.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        photo: m.photo ?? '',
        createdAt: m.created_at,
      }))
    );
  })
);

router.delete(
  '/quotes/:id',
  h(async (req, res) => {
    await query(`DELETE FROM quote_requests WHERE id = $1`, [req.params.id]);
    return res.status(204).end();
  })
);

router.get(
  '/appointments',
  h(async (_req, res) => {
    const { rows } = await query<{
      id: string;
      client_name: string;
      client_phone: string;
      slot: string;
      note: string;
      status: string;
      created_at: string;
      garage_id: string;
      garage_name: string;
    }>(
      `SELECT a.id, a.client_name, a.client_phone, a.slot, a.note, a.status, a.created_at,
              g.id AS garage_id, g.name AS garage_name
       FROM appointments a JOIN garages g ON g.id = a.garage_id
       ORDER BY a.created_at DESC LIMIT 300`
    );
    return res.json(
      rows.map((r) => ({
        id: r.id,
        clientName: r.client_name,
        clientPhone: r.client_phone,
        slot: r.slot,
        note: r.note,
        status: r.status,
        createdAt: r.created_at,
        garageId: r.garage_id,
        garageName: r.garage_name,
      }))
    );
  })
);

router.delete(
  '/appointments/:id',
  h(async (req, res) => {
    await query(`DELETE FROM appointments WHERE id = $1`, [req.params.id]);
    return res.status(204).end();
  })
);

// ─── Notifications push ─────────────────────────────────────────────────────

router.post(
  '/push',
  h(async (req, res) => {
    const { title, body, audience = 'all' } = req.body as {
      title?: string;
      body?: string;
      audience?: string;
    };
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Titre et message requis' });
    }
    if (!['all', 'clients', 'garages'].includes(audience)) {
      return res.status(400).json({ error: 'Audience invalide' });
    }
    const sent = await pushBroadcast(audience as 'all' | 'clients' | 'garages', {
      title: title.trim().slice(0, 80),
      body: body.trim().slice(0, 300),
      data: { type: 'broadcast' },
    });
    return res.json({ sent });
  })
);

export default router;
