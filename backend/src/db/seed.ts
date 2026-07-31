import bcrypt from 'bcryptjs';
import { pool } from './pool';

// Règle : un compte = un garage. Chaque garage de démo a son propre compte.
const samples = [
  {
    email: 'garage@mekano.app',
    ownerName: 'Garage Demo',
    name: 'Mekano Centre',
    description: 'Diagnostic électronique et entretien toutes marques.',
    address: '12 Avenue de l’Indépendance',
    city: 'Antananarivo',
    phone: '+261 34 00 000 01',
    latitude: -18.8792,
    longitude: 47.5079,
    services: ['vidange', 'freins', 'diagnostic', 'pneus'],
  },
  {
    email: 'garage2@mekano.app',
    ownerName: 'Behoririka Auto',
    name: 'Garage Behoririka',
    description: 'Réparations mécaniques rapides et climatisation.',
    address: 'Rue Behoririka',
    city: 'Antananarivo',
    phone: '+261 34 00 000 02',
    latitude: -18.9036,
    longitude: 47.5215,
    services: ['moteur', 'climatisation', 'batterie'],
  },
  {
    email: 'garage3@mekano.app',
    ownerName: 'Atelier Ivato',
    name: 'Atelier Ivato',
    description: 'Spécialiste 4x4 et véhicules utilitaires.',
    address: 'Route d’Ivato',
    city: 'Antananarivo',
    phone: '+261 34 00 000 03',
    latitude: -18.7969,
    longitude: 47.4788,
    services: ['4x4', 'suspension', 'échappement'],
  },
  {
    email: 'garage4@mekano.app',
    ownerName: 'Toamasina Port Auto',
    name: 'Garage Toamasina Port',
    description: 'Entretien et dépannage près du port.',
    address: 'Boulevard Maritime',
    city: 'Toamasina',
    phone: '+261 34 00 000 04',
    latitude: -18.1492,
    longitude: 49.4023,
    services: ['vidange', 'pneus', 'carrosserie'],
  },
];

async function seed() {
  const passwordHash = await bcrypt.hash('garage123', 10);

  for (const g of samples) {
    const owner = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, 'garage', 'approved')
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, status = 'approved'
       RETURNING id`,
      [g.email, passwordHash, g.ownerName]
    );
    const ownerId = owner.rows[0].id;

    await pool.query(`DELETE FROM garages WHERE owner_id = $1`, [ownerId]);
    await pool.query(
      `INSERT INTO garages
        (owner_id, name, description, address, city, phone, latitude, longitude, services, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved')`,
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
      ]
    );
  }

  console.log('Seed OK — garage@mekano.app … garage4@mekano.app / garage123');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
