import { useEffect, useState } from 'react';
import { api } from '../api';
import { useCatalog } from '../App';
import { useI18n, type TKey } from '../i18n';
import type { Stats } from '../types';

const CARDS: { key: string; label: TKey; warn?: boolean }[] = [
  { key: 'garages_total', label: 'garagesTotal' },
  { key: 'garages_pending', label: 'garagesPending', warn: true },
  { key: 'users_total', label: 'usersTotal' },
  { key: 'users_pending', label: 'usersPending', warn: true },
  { key: 'views', label: 'views' },
  { key: 'calls', label: 'calls' },
  { key: 'reviews', label: 'reviews' },
  { key: 'quotes', label: 'quotes' },
  { key: 'appointments', label: 'appointments' },
  { key: 'devices', label: 'devices' },
];

const SERIES = [
  { key: 'views', label: 'views', color: '#12717A' },
  { key: 'calls', label: 'calls', color: '#F0A72C' },
  { key: 'searches', label: 'searches', color: '#9AA6A7' },
] as const;

export function Dashboard() {
  const { t, lang } = useI18n();
  const { catalog } = useCatalog();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    api<Stats>('/stats')
      .then(setStats)
      .catch((e) => setError((e as Error).message));
  };
  useEffect(load, []);

  if (error) return <div className="empty">{error}</div>;
  if (!stats) return <div className="empty">{t('loading')}</div>;

  const max = Math.max(1, ...stats.daily.flatMap((d) => [d.views, d.calls, d.searches]));
  const countByCat = new Map(stats.byCategory.map((c) => [c.id, c.count]));
  const maxCat = Math.max(1, ...stats.byCategory.map((c) => c.count));

  return (
    <>
      <div className="page-head">
        <h1>{t('navDashboard')}</h1>
        <button className="btn" onClick={load}>
          {t('refresh')}
        </button>
      </div>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        {CARDS.map((c) => {
          const value = stats.totals[c.key] ?? 0;
          return (
            <div key={c.key} className={`stat ${c.warn && value > 0 ? 'warn' : ''}`}>
              <div className="value">{value.toLocaleString('fr-FR')}</div>
              <div className="label">{t(c.label)}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>{t('last14Days')}</h3>
          <div className="chart">
            {stats.daily.map((d) => (
              <div key={d.day} className="bar-col" title={d.day}>
                <div className="bars">
                  {SERIES.map((s) => (
                    <div
                      key={s.key}
                      className="bar"
                      style={{ height: `${(d[s.key] / max) * 100}%`, background: s.color }}
                    />
                  ))}
                </div>
                {d.day.slice(8)}
              </div>
            ))}
          </div>
          <div className="legend">
            {SERIES.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} />
                {t(s.label)}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>{t('topGarages')}</h3>
          <table>
            <tbody>
              {stats.top.map((g) => (
                <tr key={g.id}>
                  <td>
                    <strong>{g.name}</strong>
                    <div className="sub">{g.city}</div>
                  </td>
                  <td className="sub">
                    {g.views} {t('views').toLowerCase()} · {g.calls} {t('calls').toLowerCase()}
                  </td>
                </tr>
              ))}
              {stats.top.length === 0 && (
                <tr>
                  <td className="empty">{t('noResults')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>{t('garagesByType')}</h3>
        {catalog.map((c) => {
          const n = countByCat.get(c.id) ?? 0;
          return (
            <div key={c.id} className="row" style={{ marginBottom: 6 }}>
              <span style={{ width: 230 }}>
                {c.emoji} {(lang === 'mg' && c.labelMg) || c.label}
              </span>
              <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 10 }}>
                <div
                  style={{
                    width: `${(n / maxCat) * 100}%`,
                    background: 'var(--teal)',
                    height: '100%',
                    borderRadius: 6,
                  }}
                />
              </div>
              <strong style={{ width: 30, textAlign: 'right' }}>{n}</strong>
            </div>
          );
        })}
      </div>
    </>
  );
}
