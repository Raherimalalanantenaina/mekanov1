import { pool } from './pool';

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
`;

async function migrate() {
  await pool.query(SQL);
  console.log('Migration OK');
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
