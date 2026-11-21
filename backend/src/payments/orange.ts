import { config } from '../config';
import { callJson, tokenCache } from './http';
import { ProviderError, type PaymentProvider } from './types';

/**
 * Orange Money Madagascar — API « Orange Money Web Payment » :
 * https://developer.orange.com/apis/om-webpay
 * L'app ouvre `payment_url`, le client saisit son numéro et son code secret
 * sur la page Orange, puis Orange notifie `notif_url`.
 */
const cfg = () => config.payments.orange;
const API = 'https://api.orange.com';
const segment = () => (cfg().production ? cfg().country : 'dev');

const getToken = tokenCache(async () => {
  const raw = cfg().authHeader.replace(/^Basic\s+/i, '');
  const { status, body } = await callJson<{ access_token?: string; expires_in?: number }>(
    `${API}/oauth/v3/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${raw}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    }
  );
  if (status !== 200 || !body.access_token) {
    throw new ProviderError('Orange Money : authentification refusée', body);
  }
  return { token: body.access_token, expiresIn: body.expires_in ?? 3600 };
});

async function headers() {
  return {
    Authorization: `Bearer ${await getToken()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

// La sandbox Orange n'accepte que la devise de test « OUV »
const currency = () => (cfg().production ? 'MGA' : 'OUV');

export const orange: PaymentProvider = {
  id: 'orange',
  label: 'Orange Money',
  prefixes: ['32', '37'],
  redirect: true,
  enabled: () => Boolean(cfg().authHeader && cfg().merchantKey),

  async initiate(p, urls) {
    const { status, body } = await callJson<any>(`${API}/orange-money-webpay/${segment()}/v1/webpayment`, {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        merchant_key: cfg().merchantKey,
        currency: currency(),
        order_id: p.reference,
        amount: p.amount,
        return_url: urls.returnUrl,
        cancel_url: urls.cancelUrl,
        notif_url: urls.callback,
        lang: 'fr',
        reference: 'Mekano',
      }),
    });
    if (status >= 300 || !body?.pay_token || !body?.payment_url) {
      throw new ProviderError(body?.message || body?.description || 'Orange Money a refusé la transaction', body);
    }
    return {
      providerRef: body.pay_token,
      paymentUrl: body.payment_url,
      notifToken: body.notif_token,
      raw: body,
    };
  },

  async status(p) {
    const { status, body } = await callJson<any>(
      `${API}/orange-money-webpay/${segment()}/v1/transactionstatus`,
      {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({ order_id: p.reference, amount: p.amount, pay_token: p.provider_ref }),
      }
    );
    if (status >= 300) return { status: 'pending', raw: body };
    const s = String(body?.status ?? '').toUpperCase();
    if (s === 'SUCCESS') return { status: 'success', txnId: body.txnid, raw: body };
    if (s === 'FAILED' || s === 'EXPIRED') {
      return { status: 'failed', error: s === 'EXPIRED' ? 'Paiement Orange Money expiré' : 'Paiement Orange Money refusé', raw: body };
    }
    return { status: 'pending', raw: body };
  },
};
