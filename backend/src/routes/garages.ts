import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db/pool';
import { config } from '../config';
import { sendAdminValidationEmail } from '../mailer';
import { AuthedRequest, requireGarageAuth } from '../middleware/auth';

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
  services: string[];
  photos: string[];
  mobile_service: boolean;
  promo: string;
  price_list: { service: string; price: string }[];
  views: number;
  calls: number;
  opening_hours: string;
  is_open: boolean;
  status: 'pending' | 'approved';
  updated_at: string;
  created_at: string;
  distance_km?: number;
  avg_rating?: number | null;
  review_count?: number;
};

function mapGarage(row: GarageRow) {
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
    services: row.services ?? [],
    photos: row.photos ?? [],
    mobileService: row.mobile_service ?? false,
    promo: row.promo ?? '',
    priceList: row.price_list ?? [],
    views: row.views ?? 0,
    calls: row.calls ?? 0,
    openingHours: row.opening_hours,
    isOpen: row.is_open,
    status: row.status ?? 'approved',
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    distanceKm:
      row.distance_km != null ? Number(row.distance_km) : undefined,
    rating: row.avg_rating != null ? Number(row.avg_rating) : null,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
  };
}

const RATING_SELECT = `,
  (SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.garage_id = garages.id) AS avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.garage_id = garages.id) AS review_count`;

const router = Router();

/** Liste publique + recherche + géoloc optionnelle */
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const city = String(req.query.city || '').trim();
  const lat = req.query.lat != null ? Number(req.query.lat) : null;
  const lng = req.query.lng != null ? Number(req.query.lng) : null;
  const radiusKm =
    req.query.radiusKm != null ? Number(req.query.radiusKm) : 50;

  const params: unknown[] = [];
  const where: string[] = [`status = 'approved'`];

  if (q) {
    params.push(`%${q}%`);
    where.push(
      `(name ILIKE $${params.length} OR description ILIKE $${params.length} OR address ILIKE $${params.length} OR city ILIKE $${params.length})`
    );
  }
  if (city) {
    params.push(city);
    where.push(`city ILIKE $${params.length}`);
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

  const sql = `
    SELECT * ${RATING_SELECT} ${distanceSelect}
    FROM garages
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT 200
  `;

  const { rows } = await query<GarageRow>(sql, params);
  res.setHeader('X-Sync-Time', new Date().toISOString());
  return res.json({
    syncedAt: new Date().toISOString(),
    offline: false,
    garages: rows.map(mapGarage),
  });
});

/** Garages du propriétaire connecté (avec stats) */
router.get('/mine/list', requireGarageAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query<GarageRow>(
    `SELECT * ${RATING_SELECT} FROM garages WHERE owner_id = $1 ORDER BY created_at DESC`,
    [req.user!.id]
  );
  return res.json(rows.map(mapGarage));
});

router.get('/:id', async (req, res) => {
  const { rows } = await query<GarageRow>(
    `SELECT * ${RATING_SELECT} FROM garages WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Garage introuvable' });
  return res.json(mapGarage(rows[0]));
});

/** Compteurs de statistiques (vue de fiche / appel) */
router.post('/:id/track/:kind', async (req, res) => {
  const kind = req.params.kind === 'call' ? 'calls' : 'views';
  await query(`UPDATE garages SET ${kind} = ${kind} + 1 WHERE id = $1`, [
    req.params.id,
  ]);
  return res.status(204).end();
});

/** Avis */
router.get('/:id/reviews', async (req, res) => {
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
  const { rows } = await query(
    `INSERT INTO reviews (garage_id, author_name, rating, comment)
     VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
    [req.params.id, authorName.trim(), Math.round(rating), comment.trim()]
  );
  return res.status(201).json(rows[0]);
});

router.post('/', requireGarageAuth, async (req: AuthedRequest, res) => {
  const {
    name,
    description = '',
    address,
    city = '',
    phone = '',
    latitude,
    longitude,
    services = [],
    photos = [],
    mobileService = false,
    promo = '',
    priceList = [],
    openingHours = 'Lun–Sam 8h–18h',
    isOpen = true,
  } = req.body;

  if (!name || !address || latitude == null || longitude == null) {
    return res
      .status(400)
      .json({ error: 'name, address, latitude, longitude requis' });
  }

  // Le compte doit avoir été validé par l'administrateur
  const owner = await query<{ status: string; email: string; full_name: string }>(
    `SELECT status, email, full_name FROM users WHERE id = $1`,
    [req.user!.id]
  );
  if (owner.rows[0]?.status !== 'approved') {
    return res.status(403).json({
      error:
        'Ton compte est en attente de validation par l’administrateur. Tu pourras publier ton garage dès qu’il sera validé.',
    });
  }

  // Un seul garage par compte
  const existing = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM garages WHERE owner_id = $1`,
    [req.user!.id]
  );
  if (Number(existing.rows[0].count) >= 1) {
    return res.status(409).json({
      error:
        'Un seul garage par compte. Modifie ta fiche existante au lieu d’en créer une nouvelle.',
    });
  }

  const approvalToken = crypto.randomUUID();

  const { rows } = await query<GarageRow>(
    `INSERT INTO garages
      (owner_id, name, description, address, city, phone, latitude, longitude,
       services, photos, mobile_service, promo, price_list, opening_hours, is_open,
       status, approval_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',$16)
     RETURNING *`,
    [
      req.user!.id,
      name,
      description,
      address,
      city,
      phone,
      latitude,
      longitude,
      services,
      photos,
      mobileService,
      promo,
      JSON.stringify(priceList),
      openingHours,
      isOpen,
      approvalToken,
    ]
  );

  await sendAdminValidationEmail({
    subject: 'Nouveau garage à valider',
    intro: 'Un nouveau garage vient d’être publié sur Mekano et attend ta validation avant d’être visible par les clients.',
    details: {
      Garage: name,
      Adresse: `${address}${city ? `, ${city}` : ''}`,
      'Téléphone': phone || '—',
      Services: (services as string[]).join(', ') || '—',
      'Propriétaire': `${owner.rows[0].full_name} (${owner.rows[0].email})`,
    },
    approveUrl: `${config.publicUrl}/api/admin/garages/${approvalToken}/approve`,
    rejectUrl: `${config.publicUrl}/api/admin/garages/${approvalToken}/reject`,
  });

  return res.status(201).json(mapGarage(rows[0]));
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

  const { rows } = await query<GarageRow>(
    `UPDATE garages SET
      name = $1, description = $2, address = $3, city = $4, phone = $5,
      latitude = $6, longitude = $7, services = $8, photos = $9,
      mobile_service = $10, promo = $11, price_list = $12,
      opening_hours = $13, is_open = $14, updated_at = NOW()
     WHERE id = $15
     RETURNING *`,
    [
      b.name ?? g.name,
      b.description ?? g.description,
      b.address ?? g.address,
      b.city ?? g.city,
      b.phone ?? g.phone,
      b.latitude ?? g.latitude,
      b.longitude ?? g.longitude,
      b.services ?? g.services,
      b.photos ?? g.photos,
      b.mobileService ?? g.mobile_service,
      b.promo ?? g.promo,
      JSON.stringify(b.priceList ?? g.price_list),
      b.openingHours ?? g.opening_hours,
      b.isOpen ?? g.is_open,
      req.params.id,
    ]
  );
  return res.json(mapGarage(rows[0]));
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
