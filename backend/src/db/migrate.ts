import { pool } from './pool';
import { defaultIconFor, loadCatalog, resolveCategories, seedCatalogIfEmpty } from '../serviceCatalog';

const SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('garage')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS garages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  services TEXT[] NOT NULL DEFAULT '{}',
  opening_hours TEXT DEFAULT 'Lun–Sam 8h–18h',
  is_open BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE garages ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE garages ADD COLUMN IF NOT EXISTS mobile_service BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS promo TEXT NOT NULL DEFAULT '';
ALTER TABLE garages ADD COLUMN IF NOT EXISTS price_list JSONB NOT NULL DEFAULT '[]';
ALTER TABLE garages ADD COLUMN IF NOT EXISTS views INT NOT NULL DEFAULT 0;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS calls INT NOT NULL DEFAULT 0;

-- Validation par l'administrateur (les lignes existantes restent approuvées)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_token TEXT;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE garages ADD COLUMN IF NOT EXISTS approval_token TEXT;

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id UUID NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_garage ON reviews (garage_id);

CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id UUID NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  photo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotes_garage ON quote_requests (garage_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON quote_requests (client_id);

CREATE TABLE IF NOT EXISTS quote_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('client','garage')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qmsg_request ON quote_messages (request_id);
ALTER TABLE quote_messages ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id UUID NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL DEFAULT '',
  slot TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appt_garage ON appointments (garage_id);
CREATE INDEX IF NOT EXISTS idx_appt_client ON appointments (client_id);

CREATE INDEX IF NOT EXISTS idx_garages_city ON garages (city);
CREATE INDEX IF NOT EXISTS idx_garages_location ON garages (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_garages_owner ON garages (owner_id);

-- Horaires structurés par jour (null = seul le texte libre opening_hours existe)
ALTER TABLE garages ADD COLUMN IF NOT EXISTS hours_json JSONB;

-- Jetons de notification push Expo (clients anonymes et comptes garage)
CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY,
  client_id TEXT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_client ON push_tokens (client_id);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_tokens (user_id);

-- Statistiques journalières par garage (vues, appels, apparitions en recherche)
CREATE TABLE IF NOT EXISTS garage_stats_daily (
  garage_id UUID NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  views INT NOT NULL DEFAULT 0,
  calls INT NOT NULL DEFAULT 0,
  searches INT NOT NULL DEFAULT 0,
  PRIMARY KEY (garage_id, day)
);

-- Types de service (ids de service_categories) ; services = sous-types
ALTER TABLE garages ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_garages_categories ON garages USING GIN (categories);

-- Catalogue des types de service, géré depuis le site super admin
CREATE TABLE IF NOT EXISTS service_categories (
  id TEXT PRIMARY KEY,
  emoji TEXT NOT NULL DEFAULT '',
  label_fr TEXT NOT NULL,
  label_mg TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  position INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS service_subtypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  label_fr TEXT NOT NULL,
  label_mg TEXT NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_subtypes_category ON service_subtypes (category_id);
-- Icône (MaterialCommunityIcons) à la place de l'ancien emoji
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';

-- Offres (free / basic / standard / premium). Les garages déjà en ligne
-- passent en premium sans date de fin ; les nouveaux démarrent en gratuit.
ALTER TABLE garages ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'premium';
ALTER TABLE garages ALTER COLUMN plan SET DEFAULT 'free';
ALTER TABLE garages ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS plan_request TEXT;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS plan_requested_at TIMESTAMPTZ;
-- Échéance des offres : rappel envoyé (pour quelle date) et dernière expiration
ALTER TABLE garages ADD COLUMN IF NOT EXISTS plan_reminded_for TIMESTAMPTZ;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS plan_expired_at TIMESTAMPTZ;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS plan_expired_from TEXT;

-- Comptes admin du back-office, créés par le super admin (sections autorisées)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuration de l'app (clé 'app' = JSON de config, clé 'logo' = data URL)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Restaure le 1er message pour les anciennes demandes (historique en base)
INSERT INTO quote_messages (request_id, sender, body, photo)
SELECT q.id, 'client', q.description, q.photo
FROM quote_requests q
WHERE NOT EXISTS (
  SELECT 1 FROM quote_messages m WHERE m.request_id = q.id
);
`;

async function migrate() {
  await pool.query(SQL);

  await seedCatalogIfEmpty();
  const noIcon = await pool.query<{ id: string }>(
    `SELECT id FROM service_categories WHERE icon = ''`
  );
  for (const { id } of noIcon.rows) {
    await pool.query(`UPDATE service_categories SET icon = $2 WHERE id = $1`, [
      id,
      defaultIconFor(id) ?? 'wrench',
    ]);
  }
  await loadCatalog();
  // Un seul type par garage : classe les garages sans type à partir de leurs
  // services, et réduit à un type ceux qui en ont plusieurs
  const { rows } = await pool.query<{ id: string; services: string[]; categories: string[] }>(
    `SELECT id, services, categories FROM garages
     WHERE categories = '{}' OR cardinality(categories) > 1`
  );
  for (const row of rows) {
    const fromServices = resolveCategories([], row.services);
    const categories = fromServices.length ? fromServices : row.categories.slice(0, 1);
    if (categories.length) {
      await pool.query(`UPDATE garages SET categories = $2 WHERE id = $1`, [
        row.id,
        categories,
      ]);
    }
  }

  console.log('Migration OK');
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
