import { randomBytes } from 'crypto';
import { config } from '../config';
import { pool, query } from '../db/pool';
import { getConfig, type PlanId } from '../appSettings';
import { sendAdminNotice } from '../mailer';
import { pushToUser } from '../push';
import { notifyChange } from '../realtime';
import { airtel } from './airtel';
import { mvola } from './mvola';
import { orange } from './orange';
import { simulation } from './simulation';
import {
  ProviderError,
  type PaymentProvider,
  type PaymentRow,
  type ProviderId,
  type StatusResult,
} from './types';

const PROVIDERS: Record<ProviderId, PaymentProvider> = { mvola, orange, airtel, simulation };

export function getProvider(id: unknown): PaymentProvider | null {
  return typeof id === 'string' && id in PROVIDERS ? PROVIDERS[id as ProviderId] : null;
}

/** Opérateurs proposés dans l'app (ceux dont les identifiants sont configurés). */
export function enabledProviders() {
  return Object.values(PROVIDERS)
    .filter((p) => p.enabled())
    .map((p) => ({ id: p.id, label: p.label, prefixes: p.prefixes, redirect: p.redirect }));
}

/**
 * Normalise un numéro malgache en 9 chiffres sans le 0 :
 * « +261 34 12 345 67 », « 0341234567 », « 341234567 » → « 341234567 ».
 */
export function normalizeMsisdn(input: unknown): string | null {
  let d = String(input ?? '').replace(/\D/g, '');
  if (d.startsWith('261')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return /^3[2-9]\d{7}$/.test(d) ? d : null;
}

/** Référence courte, unique, sans caractères spéciaux (acceptée par les 3 opérateurs). */
function newReference() {
  return `MK${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString('hex').toUpperCase()}`;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/** Vue renvoyée à l'app / au back-office. */
export function publicPayment(p: PaymentRow) {
  return {
    id: p.id,
    reference: p.reference,
    garageId: p.garage_id,
    plan: p.plan,
    months: p.months,
    amount: p.amount,
    currency: p.currency,
    provider: p.provider,
    msisdn: p.msisdn ? `0${p.msisdn}` : '',
    status: p.status,
    paymentUrl: p.status === 'pending' ? p.payment_url : null,
    providerTxnId: p.provider_txn_id,
    error: p.error,
    createdAt: p.created_at,
    completedAt: p.completed_at,
  };
}

function urlsFor(p: PaymentRow) {
  const base = `${config.publicUrl.replace(/\/$/, '')}/api/payments`;
  return {
    callback: `${base}/callback/${p.provider}/${p.id}`,
    returnUrl: `${base}/return/${p.id}`,
    cancelUrl: `${base}/return/${p.id}?cancel=1`,
  };
}

export async function createPayment(opts: {
  garageId: string;
  userId: string;
  plan: PlanId;
  provider: unknown;
  msisdn: unknown;
  months?: number;
}): Promise<PaymentRow> {
  const provider = getProvider(opts.provider);
  if (!provider || !provider.enabled()) throw new PaymentError('Moyen de paiement indisponible');

  const { plans } = (await getConfig()).config;
  const price = plans[opts.plan]?.price ?? 0;
  if (opts.plan === 'free' || price <= 0) throw new PaymentError('Cette offre est gratuite');
  const months = Math.min(12, Math.max(1, Math.floor(opts.months ?? 1)));

  let msisdn = '';
  if (provider.prefixes.length > 0) {
    const n = normalizeMsisdn(opts.msisdn);
    if (!n && !provider.redirect) throw new PaymentError('Numéro de téléphone invalide');
    if (n && !provider.prefixes.includes(n.slice(0, 2))) {
      throw new PaymentError(
        `Ce numéro n’est pas un numéro ${provider.label} (${provider.prefixes.map((x) => `0${x}`).join(', ')})`
      );
    }
    msisdn = n ?? '';
  }

  // Une seule transaction en attente par garage : on abandonne l'ancienne
  await query(
    `UPDATE payments SET status = 'expired', error = 'Remplacé par un nouveau paiement', updated_at = NOW()
      WHERE garage_id = $1 AND status = 'pending'`,
    [opts.garageId]
  );

  const { rows } = await query<PaymentRow>(
    `INSERT INTO payments (reference, garage_id, user_id, plan, months, amount, provider, msisdn)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [newReference(), opts.garageId, opts.userId, opts.plan, months, price * months, provider.id, msisdn]
  );
  const payment = rows[0];

  try {
    const init = await provider.initiate(payment, urlsFor(payment));
    const updated = await query<PaymentRow>(
      `UPDATE payments SET provider_ref = $2, payment_url = $3, notif_token = $4,
              raw = jsonb_build_object('init', $5::jsonb), updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [payment.id, init.providerRef, init.paymentUrl ?? null, init.notifToken ?? null, JSON.stringify(init.raw ?? {})]
    );
    return updated.rows[0];
  } catch (err) {
    const message = err instanceof ProviderError ? err.message : 'Échec de la demande de paiement';
    console.warn(`Paiement ${provider.id} ${payment.reference} :`, err instanceof ProviderError ? err.details : err);
    await query(
      `UPDATE payments SET status = 'failed', error = $2, raw = jsonb_build_object('init', $3::jsonb), updated_at = NOW()
        WHERE id = $1`,
      [payment.id, message, JSON.stringify(err instanceof ProviderError ? err.details ?? {} : {})]
    );
    throw new PaymentError(message, 502);
  }
}

export async function getPayment(id: string): Promise<PaymentRow | null> {
  const { rows } = await query<PaymentRow>(`SELECT * FROM payments WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Interroge l'opérateur pour un paiement en attente et applique le résultat.
 * `includeExpired` (notification de l'opérateur) : un paiement expiré de notre
 * côté mais finalement validé par le client est quand même crédité.
 */
export async function refreshPayment(
  id: string,
  opts: { includeExpired?: boolean } = {}
): Promise<PaymentRow | null> {
  const p = await getPayment(id);
  if (!p) return null;
  if (p.status !== 'pending' && !(opts.includeExpired && p.status === 'expired')) return p;
  const provider = getProvider(p.provider);
  if (!provider || !p.provider_ref) return p;
  let result: StatusResult;
  try {
    result = await provider.status(p);
  } catch (err) {
    console.warn(`Statut ${p.provider} ${p.reference} :`, err instanceof ProviderError ? err.details : err);
    result = { status: 'pending' };
  }
  return applyResult(p, result);
}

export async function applyResult(p: PaymentRow, result: StatusResult): Promise<PaymentRow> {
  if (result.status === 'success') return completePayment(p, result);
  if (p.status !== 'pending') return p;
  if (result.status === 'failed') {
    const { rows } = await query<PaymentRow>(
      `UPDATE payments SET status = 'failed', error = $2, raw = raw || jsonb_build_object('status', $3::jsonb),
              updated_at = NOW()
        WHERE id = $1 AND status = 'pending' RETURNING *`,
      [p.id, result.error ?? 'Paiement refusé', JSON.stringify(result.raw ?? {})]
    );
    if (rows[0]) {
      pushToUser(p.user_id, {
        title: 'Paiement non abouti',
        body: `${result.error ?? 'Le paiement a échoué'}. Tu peux réessayer dans « Mon garage ».`,
        data: { type: 'payment', paymentId: p.id },
      }).catch(() => {});
    }
    return rows[0] ?? (await getPayment(p.id))!;
  }
  const ageMin = (Date.now() - new Date(p.created_at).getTime()) / 60_000;
  if (ageMin > config.payments.pendingMinutes) {
    const { rows } = await query<PaymentRow>(
      `UPDATE payments SET status = 'expired', error = 'Délai de validation dépassé', updated_at = NOW()
        WHERE id = $1 AND status = 'pending' RETURNING *`,
      [p.id]
    );
    return rows[0] ?? (await getPayment(p.id))!;
  }
  return p;
}

/**
 * Paiement confirmé : active (ou prolonge) l'offre du garage.
 * Idempotent : un même paiement n'est crédité qu'une fois, même si l'opérateur
 * notifie plusieurs fois ou si le contrôle périodique passe en même temps.
 */
async function completePayment(p: PaymentRow, result: StatusResult): Promise<PaymentRow> {
  const client = await pool.connect();
  let done: PaymentRow | undefined;
  let garage: { name: string; plan_expires_at: string | null } | undefined;
  try {
    await client.query('BEGIN');
    const upd = await client.query<PaymentRow>(
      `UPDATE payments SET status = 'success', provider_txn_id = $2, completed_at = NOW(), error = NULL,
              raw = raw || jsonb_build_object('status', $3::jsonb), updated_at = NOW()
        WHERE id = $1 AND status IN ('pending', 'expired') RETURNING *`,
      [p.id, result.txnId ?? null, JSON.stringify(result.raw ?? {})]
    );
    done = upd.rows[0];
    if (done) {
      // Même offre encore active : on prolonge depuis sa date de fin
      const g = await client.query<{ name: string; plan_expires_at: string | null }>(
        `UPDATE garages SET
            plan_expires_at = (CASE
                WHEN plan = $2 AND plan_expires_at > NOW() THEN plan_expires_at
                ELSE NOW() END) + make_interval(months => $3),
            plan = $2,
            plan_request = NULL,
            plan_requested_at = NULL,
            plan_reminded_for = NULL,
            plan_expired_from = NULL,
            plan_expired_at = NULL,
            updated_at = NOW()
          WHERE id = $1
          RETURNING name, plan_expires_at`,
        [done.garage_id, done.plan, done.months]
      );
      garage = g.rows[0];
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  if (!done) return (await getPayment(p.id))!;

  const { plans } = (await getConfig()).config;
  const planName = plans[done.plan as PlanId]?.name.fr ?? done.plan;
  const until = garage?.plan_expires_at
    ? new Date(garage.plan_expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  pushToUser(done.user_id, {
    title: `Offre ${planName} activée`,
    body: `Paiement de ${done.amount.toLocaleString('fr-FR')} Ar reçu. ${garage?.name ?? 'Ton garage'} profite de l’offre ${planName}${until ? ` jusqu’au ${until}` : ''}.`,
    data: { type: 'plan' },
  }).catch(() => {});
  sendAdminNotice({
    subject: `Paiement reçu — offre ${planName}`,
    intro: 'Un garagiste a payé son offre par mobile money. Elle a été activée automatiquement.',
    details: {
      Garage: garage?.name ?? done.garage_id,
      Offre: `${planName} (${done.months} mois)`,
      Montant: `${done.amount.toLocaleString('fr-FR')} Ar`,
      Opérateur: getProvider(done.provider)?.label ?? done.provider,
      Numéro: done.msisdn ? `0${done.msisdn}` : '—',
      Référence: done.reference,
      'Transaction opérateur': done.provider_txn_id ?? '—',
    },
  }).catch(() => {});
  notifyChange();
  return done;
}

/**
 * Contrôle périodique des paiements en attente : rattrape les notifications
 * perdues et fait expirer ceux qui n'ont jamais été validés.
 */
export async function sweepPendingPayments() {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM payments
      WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 seconds'
      ORDER BY created_at LIMIT 50`
  );
  for (const { id } of rows) {
    await refreshPayment(id).catch((err) => console.warn('Contrôle paiement :', err));
  }
}

export function startPaymentJobs() {
  setInterval(() => {
    sweepPendingPayments().catch((err) => console.warn('Contrôle des paiements :', err));
  }, 60_000);
}
