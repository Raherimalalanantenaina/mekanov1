export const PROVIDER_IDS = ['mvola', 'orange', 'airtel', 'simulation'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'expired';

export type PaymentRow = {
  id: string;
  reference: string;
  garage_id: string;
  user_id: string;
  plan: string;
  months: number;
  amount: number;
  currency: string;
  provider: ProviderId;
  /** Numéro local sur 9 chiffres, sans le 0 (ex. 341234567). */
  msisdn: string;
  status: PaymentStatus;
  provider_ref: string | null;
  provider_txn_id: string | null;
  payment_url: string | null;
  notif_token: string | null;
  error: string | null;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type InitResult = {
  /** Identifiant côté opérateur pour suivre la transaction. */
  providerRef: string;
  /** Page de paiement à ouvrir (Orange Money). */
  paymentUrl?: string;
  notifToken?: string;
  raw?: unknown;
};

export type StatusResult = {
  status: 'pending' | 'success' | 'failed';
  txnId?: string;
  error?: string;
  raw?: unknown;
};

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  /** Préfixes (sans le 0) acceptés pour le numéro payeur. */
  prefixes: string[];
  /** true : le paiement se valide sur une page web (pas de push USSD). */
  redirect: boolean;
  enabled(): boolean;
  initiate(p: PaymentRow, urls: { callback: string; returnUrl: string; cancelUrl: string }): Promise<InitResult>;
  status(p: PaymentRow): Promise<StatusResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}
