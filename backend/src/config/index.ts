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
  /**
   * Paiement mobile money. Un opérateur est proposé dans l'app dès que ses
   * identifiants sont renseignés. `*_ENV=production` bascule sur l'API réelle.
   */
  payments: {
    /** Opérateur fictif qui valide tout paiement après quelques secondes (dev / démo). */
    simulation: process.env.PAYMENT_SIMULATION === '1',
    /** Durée max d'attente de la validation sur le téléphone. */
    pendingMinutes: Number(process.env.PAYMENT_PENDING_MINUTES) || 15,
    mvola: {
      production: process.env.MVOLA_ENV === 'production',
      consumerKey: process.env.MVOLA_CONSUMER_KEY || '',
      consumerSecret: process.env.MVOLA_CONSUMER_SECRET || '',
      /** Numéro MVola marchand qui reçoit l'argent (ex. 0343500004 en sandbox). */
      merchantMsisdn: process.env.MVOLA_MERCHANT_MSISDN || '',
      partnerName: process.env.MVOLA_PARTNER_NAME || 'Mekano',
    },
    orange: {
      production: process.env.ORANGE_ENV === 'production',
      /** En-tête « Authorization » fourni par Orange Developer (sans « Basic »). */
      authHeader: process.env.ORANGE_AUTH_HEADER || '',
      merchantKey: process.env.ORANGE_MERCHANT_KEY || '',
      /** Code pays du endpoint webpay (mg). */
      country: process.env.ORANGE_COUNTRY || 'mg',
    },
    airtel: {
      production: process.env.AIRTEL_ENV === 'production',
      clientId: process.env.AIRTEL_CLIENT_ID || '',
      clientSecret: process.env.AIRTEL_CLIENT_SECRET || '',
    },
  },
  /** Identifiants du site super admin (/admin). Vides = connexion désactivée. */
  superAdmin: {
    email: (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim(),
    password: process.env.SUPERADMIN_PASSWORD || '',
  },
};
