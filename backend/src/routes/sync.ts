import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db/pool';
import { getConfig, getLogoVersion } from '../appSettings';
import { getCatalogVersion } from '../serviceCatalog';
import { effectivePlanSql } from '../plans';

const router = Router();

/**
 * Empreintes légères des données affichées par l'app mobile. L'app interroge
 * cette route régulièrement et ne recharge que ce qui a changé.
 * Les compteurs vues/appels sont exclus (ils bougent sans cesse).
 */
router.get('/', async (req, res, next) => {
  try {
    const { updatedAt } = await getConfig();
    const logoVersion = await getLogoVersion();
    const out: Record<string, string> = {
      config: `${updatedAt}-${getCatalogVersion()}-${logoVersion ?? 0}`,
    };

    const garages = await query<{ h: string }>(`
      SELECT md5(COALESCE(string_agg(
        g.id || g.status || g.updated_at || g.is_open || ${effectivePlanSql('g')} || array_to_string(g.services, '|'),
        ',' ORDER BY g.id), '')
        || (SELECT COUNT(*) || COALESCE(MAX(created_at)::text, '') FROM reviews)) AS h
      FROM garages g WHERE g.status = 'approved'
    `);
    out.garages = garages.rows[0].h;

    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId.slice(0, 100) : '';
    if (clientId) {
      const client = await query<{ h: string }>(
        `SELECT md5(COALESCE(string_agg(x, ',' ORDER BY x), '')) AS h FROM (
           SELECT q.id || q.status || COALESCE((
             SELECT COUNT(*) || MAX(m.created_at)::text FROM quote_messages m WHERE m.request_id = q.id
           ), '') AS x
           FROM quote_requests q WHERE q.client_id = $1
           UNION ALL
           SELECT a.id || a.status FROM appointments a WHERE a.client_id = $1
         ) t`,
        [clientId]
      );
      out.client = client.rows[0].h;
    }

    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwtSecret) as { id?: string; role?: string };
        if (payload.role === 'garage' && payload.id) {
          const account = await query<{ h: string }>(
            `SELECT md5(COALESCE((SELECT status FROM users WHERE id = $1), 'deleted') || COALESCE((
               SELECT string_agg(
                 g.id || g.status || g.updated_at || g.is_open || g.plan || COALESCE(g.plan_expires_at::text, '')
                   || COALESCE(g.plan_request, '') || ${effectivePlanSql('g')},
                 ',' ORDER BY g.id)
               FROM garages g WHERE g.owner_id = $1), '')) AS h`,
            [payload.id]
          );
          const inbox = await query<{ h: string }>(
            `SELECT md5(COALESCE(string_agg(x, ',' ORDER BY x), '')) AS h FROM (
               SELECT q.id || q.status || COALESCE((
                 SELECT COUNT(*) || MAX(m.created_at)::text FROM quote_messages m WHERE m.request_id = q.id
               ), '') AS x
               FROM quote_requests q JOIN garages g ON g.id = q.garage_id WHERE g.owner_id = $1
               UNION ALL
               SELECT a.id || a.status FROM appointments a JOIN garages g ON g.id = a.garage_id WHERE g.owner_id = $1
             ) t`,
            [payload.id]
          );
          out.account = account.rows[0].h;
          out.inbox = inbox.rows[0].h;
        }
      } catch {
        /* jeton expiré : seules les données publiques sont synchronisées */
      }
    }

    res.set('Cache-Control', 'no-store');
    return res.json(out);
  } catch (err) {
    next(err);
  }
});

export default router;
