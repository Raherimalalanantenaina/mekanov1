import { config } from '../config';
import { callJson, tokenCache } from './http';
import { ProviderError, type PaymentProvider } from './types';

/**
 * Airtel Money Madagascar — API « Collection » (USSD push) :
 * https://developers.airtel.africa
 * Le client reçoit une demande USSD et valide avec son code PIN.
 */
const cfg = () => config.payments.airtel;
const base = () => (cfg().production ? 'https://openapi.airtel.africa' : 'https://openapiuat.airtel.africa');
const COUNTRY = 'MG';
const CURRENCY = 'MGA';

const getToken = tokenCache(async () => {
  const { status, body } = await callJson<{ access_token?: string; expires_in?: number | string }>(
    `${base()}/auth/oauth2/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: '*/*' },
      body: JSON.stringify({
        client_id: cfg().clientId,
        client_secret: cfg().clientSecret,
        grant_type: 'client_credentials',
      }),
    }
  );
  if (status !== 200 || !body.access_token) {
    throw new ProviderError('Airtel Money : authentification refusée', body);
  }
  return { token: body.access_token, expiresIn: Number(body.expires_in) || 180 };
});

async function headers() {
  return {
    Authorization: `Bearer ${await getToken()}`,
    'Content-Type': 'application/json',
    Accept: '*/*',
    'X-Country': COUNTRY,
    'X-Currency': CURRENCY,
  };
}

export const airtel: PaymentProvider = {
  id: 'airtel',
  label: 'Airtel Money',
  prefixes: ['33'],
  redirect: false,
  enabled: () => Boolean(cfg().clientId && cfg().clientSecret),

  async initiate(p) {
    const { status, body } = await callJson<any>(`${base()}/merchant/v1/payments/`, {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        reference: `Mekano offre ${p.plan}`.slice(0, 64),
        subscriber: { country: COUNTRY, currency: CURRENCY, msisdn: p.msisdn },
        transaction: { amount: p.amount, country: COUNTRY, currency: CURRENCY, id: p.reference },
      }),
    });
    if (status >= 300 || body?.status?.success === false) {
      throw new ProviderError(body?.status?.message || 'Airtel Money a refusé la transaction', body);
    }
    // Airtel suit la transaction avec notre propre identifiant
    return { providerRef: p.reference, raw: body };
  },

  async status(p) {
    const { status, body } = await callJson<any>(`${base()}/standard/v1/payments/${p.reference}`, {
      headers: await headers(),
    });
    if (status >= 300) return { status: 'pending', raw: body };
    const tx = body?.data?.transaction ?? {};
    const s = String(tx.status ?? '').toUpperCase();
    if (s === 'TS') return { status: 'success', txnId: tx.airtel_money_id, raw: body };
    if (s === 'TF' || s === 'TE') {
      return { status: 'failed', error: tx.message || 'Paiement Airtel Money refusé ou expiré', raw: body };
    }
    // TIP (en cours) ou TA (ambigu) : on attend
    return { status: 'pending', raw: body };
  },
};
