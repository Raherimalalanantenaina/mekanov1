import bcrypt from 'bcryptjs';
import { pool } from './pool';
import { resolveCategories } from '../serviceCatalog';

// Règle : un compte = un garage. Chaque garage de démo a son propre compte.
// Le seed ne SUPPRIME jamais un garage existant (sinon CASCADE efface
// photos, devis, messages et RDV). Il crée ou met à jour sans toucher aux photos.
const samples = [
  {
    email: 'garage@mekano.app',
    ownerName: 'Garage Demo',
    name: 'Mekano Centre',
    description: 'Entretien et mécanique toutes marques.',
    address: '12 Avenue de l’Indépendance',
    city: 'Antananarivo',
    phone: '+261 34 00 000 01',
    latitude: -18.8792,
    longitude: 47.5079,
    services: ['Vidange', 'Freinage', 'Moteur'],
  },
  {
    email: 'garage2@mekano.app',
    ownerName: 'Behoririka Auto',
    name: 'Garage Behoririka',
    description: 'Recharge et réparation de climatisation auto.',
    address: 'Rue Behoririka',
    city: 'Antananarivo',
    phone: '+261 34 00 000 02',
    latitude: -18.9036,
    longitude: 47.5215,
    services: ['Recharge clim', 'Réparation clim'],
  },
  {
    email: 'garage3@mekano.app',
    ownerName: 'Atelier Ivato',
    name: 'Atelier Ivato',
    description: 'Dépannage et remorquage 4x4 et utilitaires.',
    address: 'Route d’Ivato',
    city: 'Antananarivo',
    phone: '+261 34 00 000 03',
    latitude: -18.7969,
    longitude: 47.4788,
    services: ['Intervention sur route', 'Remorquage'],
  },
  {
    email: 'garage4@mekano.app',
    ownerName: 'Toamasina Port Auto',
    name: 'Garage Toamasina Port',
    description: 'Vulcanisation et pneus près du port.',
    address: 'Boulevard Maritime',
    city: 'Toamasina',
    phone: '+261 34 00 000 04',
    latitude: -18.1492,
    longitude: 49.4023,
    services: ['Crevaison', 'Réparation pneu', 'Montage pneu'],
  },
];

async function seed() {
  const passwordHash = await bcrypt.hash('garage123', 10);

  for (const g of samples) {
    const categories = resolveCategories([], g.services);
    const owner = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, 'garage', 'approved')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         status = 'approved'
       RETURNING id`,
      [g.email, passwordHash, g.ownerName]
    );
    const ownerId = owner.rows[0].id;

    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM garages WHERE owner_id = $1 LIMIT 1`,
      [ownerId]
    );

    if (existing.rows[0]) {
      // Met à jour la fiche démo SANS toucher photos / stats / horaires perso
      await pool.query(
        `UPDATE garages SET
           name = $2,
           description = $3,
           address = $4,
           city = $5,
           phone = $6,
           latitude = $7,
           longitude = $8,
           services = $9,
           categories = $10,
           status = 'approved',
           updated_at = NOW()
         WHERE id = $1`,
        [
          existing.rows[0].id,
          g.name,
          g.description,
          g.address,
          g.city,
          g.phone,
          g.latitude,
          g.longitude,
          g.services,
          categories,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO garages
          (owner_id, name, description, address, city, phone, latitude, longitude, services, categories, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'approved')`,
        [
          ownerId,
          g.name,
          g.description,
          g.address,
          g.city,
          g.phone,
          g.latitude,
          g.longitude,
          g.services,
          categories,
        ]
      );
    }
  }

  // Anciennes demandes sans message : crée le 1er message depuis la description
  const backfill = await pool.query(
    `INSERT INTO quote_messages (request_id, sender, body, photo)
     SELECT q.id, 'client', q.description, q.photo
     FROM quote_requests q
     WHERE NOT EXISTS (
       SELECT 1 FROM quote_messages m WHERE m.request_id = q.id
     )`
  );

  console.log(
    `Seed OK — garage@mekano.app … garage4@mekano.app / garage123` +
      (backfill.rowCount
        ? ` (${backfill.rowCount} message(s) d’historique restauré(s))`
        : ' (données existantes conservées)')
  );
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
