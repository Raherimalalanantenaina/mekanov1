import { useCallback, useEffect, useState } from 'react';
import { mdiCashMultiple, mdiCellphoneCheck, mdiRefresh } from '@mdi/js';
import { api } from '../api';
import { MdiIcon } from '../CategoryIcon';
import { useI18n } from '../i18n';
import { formatDate, PageHead, PlanBadge, StatusBadge, useAction } from '../ui';
import { useAppConfig } from '../useAppConfig';

type PaymentItem = {
  id: string;
  reference: string;
  garageId: string;
  garageName: string;
  plan: string;
  months: number;
  amount: number;
  provider: string;
  msisdn: string;
  status: 'pending' | 'success' | 'failed' | 'expired';
  providerTxnId: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

type Response = {
  providers: { id: string; label: string }[];
  totals: { total: number; month: number; count: number };
  payments: PaymentItem[];
};

const PROVIDER_LABELS: Record<string, string> = {
  mvola: 'MVola',
  orange: 'Orange Money',
  airtel: 'Airtel Money',
  simulation: 'Simulation',
};

const ar = (n: number) => `${n.toLocaleString('fr-FR')} Ar`;

/** Paiements mobile money des offres (MVola, Orange Money, Airtel Money). */
export function Payments() {
  const { t, lang } = useI18n();
  const { config } = useAppConfig();
  const { run, busy } = useAction();
  const [data, setData] = useState<Response | null>(null);
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (provider) params.set('provider', provider);
    if (q.trim()) params.set('q', q.trim());
    api<Response>(`/payments?${params}`).then(setData);
  }, [status, provider, q]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const recheck = (p: PaymentItem) =>
    run(async () => {
      await api(`/payments/${p.id}/refresh`, { method: 'POST' });
      load();
    });

  return (
    <>
      <PageHead title={t('navPayments')} hint={t('paymentsHint')} icon={mdiCashMultiple}>
        <button className="btn" onClick={load}>
          <MdiIcon path={mdiRefresh} size={17} /> {t('refresh')}
        </button>
      </PageHead>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="stat">
          <span className="stat-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
            <MdiIcon path={mdiCashMultiple} size={26} />
          </span>
          <div>
            <div className="value">{data ? ar(data.totals.month) : '—'}</div>
            <div className="label">{t('paymentsMonth')}</div>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
            <MdiIcon path={mdiCashMultiple} size={26} />
          </span>
          <div>
            <div className="value">{data ? ar(data.totals.total) : '—'}</div>
            <div className="label">{t('paymentsTotal', { n: data?.totals.count ?? 0 })}</div>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon" style={{ background: 'var(--amber-soft)', color: '#b26a00' }}>
            <MdiIcon path={mdiCellphoneCheck} size={26} />
          </span>
          <div>
            <div className="value" style={{ fontSize: 15 }}>
              {data ? data.providers.map((p) => p.label).join(', ') || t('paymentsNoProvider') : '—'}
            </div>
            <div className="label">{t('paymentsProviders')}</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">
            {t('status')}: {t('all')}
          </option>
          <option value="success">{t('st_success')}</option>
          <option value="pending">{t('st_pending')}</option>
          <option value="failed">{t('st_failed')}</option>
          <option value="expired">{t('st_expired')}</option>
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="">
            {t('paymentsProvider')}: {t('all')}
          </option>
          {Object.entries(PROVIDER_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('createdAt')}</th>
              <th>{t('garage')}</th>
              <th>{t('navPlans')}</th>
              <th>{t('paymentsAmount')}</th>
              <th>{t('paymentsProvider')}</th>
              <th>{t('status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.payments.map((p) => (
              <tr key={p.id}>
                <td className="sub">{formatDate(p.createdAt, lang)}</td>
                <td>
                  <a href={`#/garages?q=${encodeURIComponent(p.garageName)}`}>
                    <strong>{p.garageName}</strong>
                  </a>
                  <div className="sub">{p.reference}</div>
                </td>
                <td>
                  <PlanBadge plan={p.plan} name={config?.plans[p.plan as keyof typeof config.plans]?.name.fr} />
                  {p.months > 1 && <div className="sub">{p.months} mois</div>}
                </td>
                <td>
                  <strong>{ar(p.amount)}</strong>
                </td>
                <td>
                  {PROVIDER_LABELS[p.provider] ?? p.provider}
                  <div className="sub">
                    {p.msisdn || '—'}
                    {p.providerTxnId ? ` · ${p.providerTxnId}` : ''}
                  </div>
                </td>
                <td>
                  <StatusBadge status={p.status} />
                  {p.error && p.status !== 'success' && <div className="sub">{p.error}</div>}
                </td>
                <td className="actions">
                  {(p.status === 'pending' || p.status === 'expired') && (
                    <button className="btn btn-sm" disabled={busy} onClick={() => recheck(p)}>
                      {t('paymentsRecheck')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.payments.length === 0 && <div className="empty">{t('noResults')}</div>}
        {!data && <div className="empty">{t('loading')}</div>}
      </div>
    </>
  );
}
