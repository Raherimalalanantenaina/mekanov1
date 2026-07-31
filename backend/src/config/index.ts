import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://mekano:mekano@localhost:5432/mekano',
  jwtSecret: process.env.JWT_SECRET || 'mekano-dev-secret',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  /** Email de l'administrateur qui valide les comptes et garages. */
  adminEmail: process.env.ADMIN_EMAIL || 'nantenainaraherimalala@gmail.com',
  /** URL publique de l'API (utilisée dans les liens de validation). */
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${Number(process.env.PORT) || 4000}`,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};
