import { Router } from 'express';
import { query } from '../db/pool';
import { isPlanId } from '../plans';
import { AuthedRequest, requireGarageAuth } from '../middleware/auth';
import {
  applyResult,
  createPayment,
  enabledProviders,
  getPayment,
  PaymentError,
  publicPayment,
  refreshPayment,
} from '../payments/service';
import type { PaymentRow } from '../payments/types';

const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opérateurs disponibles (MVola, Orange Money, Airtel Money…). */
router.get('/providers', (_req, res) => {
  res.json(enabledProviders());
});

/** Lance le paiement d'une offre : push USSD (MVola / Airtel) ou page web (Orange). */
router.post('/', requireGarageAuth, async (req: AuthedRequest, res) => {
  const { garageId, plan, provider, msisdn, months } = req.body as {
    garageId?: string;
    plan?: string;
    provider?: string;
    msisdn?: string;
    months?: number;
  };
  if (!garageId || !UUID.test(garageId)) return res.status(400).json({ error: 'Garage invalide' });
  if (!isPlanId(plan)) return res.status(400).json({ error: 'Offre invalide' });
  const { rows } = await query<{ owner_id: string }>(`SELECT owner_id FROM garages WHERE id = $1`, [garageId]);
  if (!rows[0]) return res.status(404).json({ error: 'Garage introuvable' });
  if (rows[0].owner_id !== req.user!.id) return res.status(403).json({ error: 'Non autorisé' });

  try {
    const p = await createPayment({
      garageId,
      userId: req.user!.id,
      plan,
      provider,
      msisdn,
      months: Number(months) || 1,
    });
    return res.status(201).json(publicPayment(p));
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

/** Historique des paiements d'un garage. */
router.get('/garage/:garageId', requireGarageAuth, async (req: AuthedRequest, res) => {
  const { rows } = await query<PaymentRow>(
    `SELECT p.* FROM payments p JOIN garages g ON g.id = p.garage_id
      WHERE p.garage_id = $1 AND g.owner_id = $2
      ORDER BY p.created_at DESC LIMIT 30`,
    [req.params.garageId, req.user!.id]
  );
  res.json(rows.map(publicPayment));
});

/** État d'un paiement (l'app interroge cette route en attendant la validation). */
router.get('/:id', requireGarageAuth, async (req: AuthedRequest, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const p = await getPayment(req.params.id);
  if (!p || p.user_id !== req.user!.id) return res.status(404).json({ error: 'Paiement introuvable' });
  const fresh = p.status === 'pending' ? await refreshPayment(p.id) : p;
  res.json(publicPayment(fresh ?? p));
});

// ─── Notifications des opérateurs ──────────────────────────────────────────
// Elles ne sont jamais crues sur parole : on revérifie auprès de l'opérateur
// (MVola, Airtel) ou on contrôle le jeton secret de la transaction (Orange).

/** MVola : PUT sur X-Callback-URL. */
router.all('/callback/mvola/:id', async (req, res) => {
  res.status(200).json({ ok: true });
  if (UUID.test(req.params.id)) {
    refreshPayment(req.params.id, { includeExpired: true }).catch((err) =>
      console.warn('Callback MVola :', err)
    );
  }
});

/** Orange Money : POST sur notif_url { status, notif_token, txnid }. */
router.post('/callback/orange/:id', async (req, res) => {
  res.status(200).json({ ok: true });
  if (!UUID.test(req.params.id)) return;
  const body = req.body as { status?: string; notif_token?: string; txnid?: string };
  const p = await getPayment(req.params.id);
  if (!p || p.provider !== 'orange' || !p.notif_token || body.notif_token !== p.notif_token) {
    console.warn('Callback Orange ignoré (jeton invalide)', req.params.id);
    return;
  }
  const s = String(body.status ?? '').toUpperCase();
  if (s === 'SUCCESS') {
    await applyResult(p, { status: 'success', txnId: body.txnid, raw: body });
  } else if (s === 'FAILED' || s === 'EXPIRED') {
    await applyResult(p, { status: 'failed', error: 'Paiement Orange Money refusé', raw: body });
  }
});

/**
 * Airtel Money : une seule URL déclarée dans le portail Airtel, le corps porte
 * notre référence ({ transaction: { id, status_code } }).
 */
async function airtelCallback(body: { transaction?: { id?: string } }) {
  const ref = body?.transaction?.id;
  if (!ref) return;
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM payments WHERE reference = $1 AND provider = 'airtel'`,
    [String(ref)]
  );
  if (rows[0]) await refreshPayment(rows[0].id, { includeExpired: true });
}
router.post('/callback/airtel', async (req, res) => {
  res.status(200).json({ ok: true });
  airtelCallback(req.body).catch((err) => console.warn('Callback Airtel :', err));
});
router.post('/callback/airtel/:id', async (req, res) => {
  res.status(200).json({ ok: true });
  airtelCallback(req.body).catch((err) => console.warn('Callback Airtel :', err));
});

/** Simulation : rien à recevoir, la route existe pour garder des URLs uniformes. */
router.all('/callback/simulation/:id', (_req, res) => {
  res.json({ ok: true });
});

/** Page de retour après la page de paiement Orange Money. */
router.get('/return/:id', async (req, res) => {
  const cancelled = req.query.cancel === '1';
  let status = 'pending';
  if (UUID.test(req.params.id)) {
    const p = await refreshPayment(req.params.id).catch(() => null);
    if (p) status = p.status;
  }
  const msg =
    status === 'success'
      ? 'Paiement reçu, ton offre est activée.'
      : cancelled
        ? 'Paiement annulé.'
        : status === 'failed'
          ? 'Le paiement a échoué.'
          : 'Paiement en cours de vérification…';
  res.type('html').send(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Mekano — Paiement</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f7f8;color:#111;display:flex;min-height:100vh;
align-items:center;justify-content:center;margin:0;padding:16px}div{background:#fff;border-radius:16px;
padding:28px;max-width:360px;text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.08)}h1{font-size:20px;
color:#0f766e;margin:0 0 8px}p{margin:0;color:#444;line-height:1.5}</style></head>
<body><div><h1>${msg}</h1><p>Tu peux fermer cette page et revenir dans l’application Mekano.</p></div></body></html>`);
});

export default router;
