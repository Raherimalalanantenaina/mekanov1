import { randomUUID } from 'crypto';
import { config } from '../config';
import { basic, callJson, tokenCache } from './http';
import { ProviderError, type PaymentProvider } from './types';

/**
 * MVola (Telma / Yas) — API « Merchant Pay » : https://developer.mvola.mg
 * Le client reçoit une demande sur son téléphone et valide avec son code secret.
 */
const cfg = () => config.payments.mvola;
const base = () => (cfg().production ? 'https://api.mvola.mg' : 'https://devapi.mvola.mg');
const PATH = '/mvola/mm/transactions/type/merchantpay/1.0.0';

const getToken = tokenCache(async () => {
  const { status, body } = await callJson<{ access_token?: string; expires_in?: number }>(
    `${base()}/token`,
    {
      method: 'POST',
      headers: {
        Authorization: basic(cfg().consumerKey, cfg().consumerSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: 'grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE',
    }
  );
  if (status !== 200 || !body.access_token) {
    throw new ProviderError('MVola : authentification refusée', body);
  }
  return { token: body.access_token, expiresIn: body.expires_in ?? 3600 };
});

/** Numéro au format MVola : 034xxxxxxx. */
const local = (msisdn: string) => (msisdn.startsWith('0') ? msisdn : `0${msisdn}`);

async function headers(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${await getToken()}`,
    Version: '1.0',
    'X-CorrelationID': randomUUID(),
    UserLanguage: 'FR',
    UserAccountIdentifier: `msisdn;${local(cfg().merchantMsisdn)}`,
    partnerName: cfg().partnerName,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...extra,
  };
}

function errorText(body: any): string {
  const e = body?.fault ?? body?.errorDescription ?? body?.ErrorDescription ?? body?.errorMessage;
  if (typeof e === 'string') return e;
  if (e?.message) return e.message;
  return 'MVola a refusé la transaction';
}

export const mvola: PaymentProvider = {
  id: 'mvola',
  label: 'MVola',
  prefixes: ['34', '38'],
  redirect: false,
  enabled: () => Boolean(cfg().consumerKey && cfg().consumerSecret && cfg().merchantMsisdn),

  async initiate(p, urls) {
    // Description : 50 caractères max, sans caractères spéciaux
    const description = `Mekano offre ${p.plan} ${p.reference}`.replace(/[^A-Za-z0-9 .,_-]/g, '').slice(0, 50);
    const { status, body } = await callJson<any>(`${base()}${PATH}/`, {
      method: 'POST',
      headers: await headers({ 'X-Callback-URL': urls.callback }),
      body: JSON.stringify({
        amount: String(p.amount),
        currency: 'Ar',
        descriptionText: description,
        requestDate: new Date().toISOString(),
        debitParty: [{ key: 'msisdn', value: local(p.msisdn) }],
        creditParty: [{ key: 'msisdn', value: local(cfg().merchantMsisdn) }],
        metadata: [
          { key: 'partnerName', value: cfg().partnerName },
          { key: 'fc', value: 'USD' },
          { key: 'amountFc', value: '1' },
        ],
        requestingOrganisationTransactionReference: p.reference,
        originalTransactionReference: p.reference,
      }),
    });
    if (status >= 300 || !body?.serverCorrelationId) {
      throw new ProviderError(errorText(body), body);
    }
    return { providerRef: body.serverCorrelationId, raw: body };
  },

  async status(p) {
    const { status, body } = await callJson<any>(`${base()}${PATH}/status/${p.provider_ref}`, {
      headers: await headers(),
    });
    if (status >= 300) return { status: 'pending', raw: body };
    const s = String(body?.status ?? '').toLowerCase();
    if (s === 'completed') return { status: 'success', txnId: body.objectReference, raw: body };
    if (s === 'failed') return { status: 'failed', error: 'Paiement MVola refusé ou annulé', raw: body };
    return { status: 'pending', raw: body };
  },
};
