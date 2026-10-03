import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useCatalog, useRefreshCounts } from '../App';
import { useI18n } from '../i18n';
import type { GarageListItem, GarageStatus } from '../types';
import { StatusBadge, useAction } from '../ui';
import { GarageEditor } from './GarageEditor';

export function Garages() {
  const { t, lang } = useI18n();
  const { catalog } = useCatalog();
  const refreshCounts = useRefreshCounts();
  const { run } = useAction();
  const [list, setList] = useState<GarageListItem[] | null>(null);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null | undefined>(undefined);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (q.trim()) params.set('q', q.trim());
    api<GarageListItem[]>(`/garages?${params}`).then(setList);
  }, [status, category, q]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const setGarageStatus = (g: GarageListItem, next: GarageStatus) =>
    run(async () => {
      await api(`/garages/${g.id}`, { method: 'PUT', body: { status: next } });
      load();
      refreshCounts();
    });

  const catName = (id: string) => {
    const c = catalog.find((x) => x.id === id);
    return c ? `${c.emoji} ${(lang === 'mg' && c.labelMg) || c.label}` : id;
  };

  return (
    <>
      <div className="page-head">
        <h1>{t('navGarages')}</h1>
        <button className="btn btn-primary" onClick={() => setEditing(null)}>
          + {t('newGarage')}
        </button>
      </div>

      <div className="toolbar">
        <input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">
            {t('status')}: {t('all')}
          </option>
          <option value="pending">{t('st_pending')}</option>
          <option value="approved">{t('st_approved')}</option>
          <option value="hidden">{t('st_hidden')}</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">
            {t('types')}: {t('all')}
          </option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {catName(c.id)}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>{t('types')}</th>
              <th>{t('owner')}</th>
              <th>{t('status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list?.map((g) => (
              <tr key={g.id}>
                <td>
                  <strong>{g.name}</strong>
                  <div className="sub">
                    {g.city || g.address} · {g.phone}
                  </div>
                  <div className="sub">
                    {g.views} {t('views').toLowerCase()} · {g.calls} {t('calls').toLowerCase()} · {g.photoCount}{' '}
                    {t('photoCount')}
                    {g.rating != null ? ` · ★ ${g.rating}` : ''}
                  </div>
                </td>
                <td style={{ maxWidth: 300 }}>
                  {g.categories.map((c) => (
                    <span key={c} className="chip">
                      {catName(c)}
                    </span>
                  ))}
                  {g.services.length > 0 && <div className="sub">{g.services.join(', ')}</div>}
                </td>
                <td>
                  {g.ownerName}
                  <div className="sub">{g.ownerEmail}</div>
                  {g.ownerStatus !== 'approved' && <StatusBadge status={g.ownerStatus} />}
                </td>
                <td>
                  <StatusBadge status={g.status} />
                </td>
                <td className="actions">
                  {g.status !== 'approved' && (
                    <button className="btn btn-sm btn-primary" onClick={() => setGarageStatus(g, 'approved')}>
                      {t('approve')}
                    </button>
                  )}
                  {g.status !== 'hidden' && (
                    <button className="btn btn-sm" onClick={() => setGarageStatus(g, 'hidden')}>
                      {t('hide')}
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => setEditing(g.id)}>
                    {t('edit')}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (!confirm(t('confirmDelete'))) return;
                      run(async () => {
                        await api(`/garages/${g.id}`, { method: 'DELETE' });
                        load();
                        refreshCounts();
                      });
                    }}
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list && list.length === 0 && <div className="empty">{t('noResults')}</div>}
        {!list && <div className="empty">{t('loading')}</div>}
      </div>

      {editing !== undefined && (
        <GarageEditor
          id={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
            refreshCounts();
          }}
        />
      )}
    </>
  );
}
