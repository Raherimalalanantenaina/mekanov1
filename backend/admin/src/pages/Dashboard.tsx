import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { PLAN_IDS, type Stats } from '../types';
import { Loader, PageHead, PlanBadge } from '../ui';
import { mdiCashMultiple, mdiChartBar, mdiCrownOutline, mdiGarageVariant, mdiRefresh, mdiTableLarge, mdiViewDashboardOutline } from '@mdi/js';
import { MdiIcon } from '../CategoryIcon';
import { useAppConfig } from '../useAppConfig';

const PLAN_COLORS: Record<string, string> = {
  free: '#9AA6A7',
  basic: '#0369a1',
  standard: '#12717A',
  premium: '#F0A72C',
};

const ar = (n: number) => `${n.toLocaleString('fr-FR')} Ar`;

export function Dashboard() {
  const { t, lang } = useI18n();
  const { config } = useAppConfig();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    api<Stats>('/stats')
      .then(setStats)
      .catch((e) => setError((e as Error).message));
  };
  useEffect(load, []);

  if (error) return <div className="empty">{error}</div>;
  if (!stats || !config) return <Loader />;

  // Offres expirées déjà comptées en gratuit côté serveur
  const rows = PLAN_IDS.map((id) => {
    const count = stats.byPlan?.find((p) => p.id === id)?.count ?? 0;
    const price = config.plans[id].price;
    return {
      id,
      name: (lang === 'mg' && config.plans[id].name.mg) || config.plans[id].name.fr || id,
      count,
      price,
      amount: count * price,
    };
  });
  const total = stats.totals.garages_total ?? 0;
  const paid = rows.filter((r) => r.price > 0).reduce((s, r) => s + r.count, 0);
  const revenue = rows.reduce((s, r) => s + r.amount, 0);
  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  return (
    <>
      <PageHead title={t('navDashboard')} icon={mdiViewDashboardOutline}>
        <button className="btn" onClick={load}>
          <MdiIcon path={mdiRefresh} size={17} /> {t('refresh')}
        </button>
      </PageHead>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="stat">
          <span className="stat-icon" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
            <MdiIcon path={mdiGarageVariant} size={26} />
          </span>
          <div>
            <div className="value">{total.toLocaleString('fr-FR')}</div>
            <div className="label">{t('garagesTotal')}</div>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon" style={{ background: 'var(--amber-soft)', color: '#b26a00' }}>
            <MdiIcon path={mdiCrownOutline} size={26} />
          </span>
          <div>
            <div className="value">{paid.toLocaleString('fr-FR')}</div>
            <div className="label">{t('paidGarages')}</div>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
            <MdiIcon path={mdiCashMultiple} size={26} />
          </span>
          <div>
            <div className="value">{ar(revenue)}</div>
            <div className="label">{t('monthlyRevenue')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <MdiIcon path={mdiChartBar} size={20} />
            <h3>{t('byPlan')}</h3>
          </div>
          <div className="chart" style={{ height: 220, gap: 16 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                className="bar-col"
                title={`${r.name} : ${r.count}`}
                style={{ fontSize: 12, color: 'var(--muted)' }}
              >
                <strong style={{ color: 'var(--ink, #111)', fontSize: 14 }}>{r.count}</strong>
                <div className="bars" style={{ justifyContent: 'center' }}>
                  <div
                    className="bar"
                    style={{
                      height: `${(r.count / maxCount) * 100}%`,
                      background: PLAN_COLORS[r.id],
                      flex: '0 0 55%',
                    }}
                  />
                </div>
                {r.name}
              </div>
            ))}
          </div>
        </div>

        <div className="card card-flush">
          <div className="card-title" style={{ padding: '18px 20px 0' }}>
            <MdiIcon path={mdiTableLarge} size={20} />
            <h3>{t('amount')}</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t('plan')}</th>
                <th>{t('tabGarages')}</th>
                <th>{t('planPrice')}</th>
                <th>{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <PlanBadge plan={r.id} name={r.name} />
                  </td>
                  <td>{r.count}</td>
                  <td className="sub">{r.price > 0 ? ar(r.price) : t('free')}</td>
                  <td>
                    <strong>{ar(r.amount)}</strong>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}>
                  <strong>{t('total')}</strong>
                </td>
                <td>
                  <strong>{ar(revenue)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="hint" style={{ padding: '0 16px 12px' }}>
            {t('revenueHint')}
          </p>
        </div>
      </div>
    </>
  );
}
