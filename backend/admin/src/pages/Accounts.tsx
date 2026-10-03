import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useRefreshCounts } from '../App';
import { useI18n } from '../i18n';
import type { UserItem, UserStatus } from '../types';
import { Field, formatDate, Modal, StatusBadge, useAction } from '../ui';

export function Accounts() {
  const { t, lang } = useI18n();
  const refreshCounts = useRefreshCounts();
  const { run, busy } = useAction();
  const [list, setList] = useState<UserItem[] | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', fullName: '', password: '' });

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    api<UserItem[]>(`/users?${params}`).then(setList);
  }, [status, q]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const setUserStatus = (u: UserItem, next: UserStatus) =>
    run(async () => {
      await api(`/users/${u.id}`, { method: 'PUT', body: { status: next } });
      load();
      refreshCounts();
    });

  return (
    <>
      <div className="page-head">
        <h1>{t('navAccounts')}</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + {t('newAccount')}
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
          <option value="suspended">{t('st_suspended')}</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('fullName')}</th>
              <th>{t('garage')}</th>
              <th>{t('createdAt')}</th>
              <th>{t('status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list?.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.fullName}</strong>
                  <div className="sub">{u.email}</div>
                </td>
                <td>
                  {u.garageName ? (
                    <>
                      {u.garageName} {u.garageStatus && <StatusBadge status={u.garageStatus} />}
                    </>
                  ) : (
                    <span className="sub">{t('noGarage')}</span>
                  )}
                </td>
                <td className="sub">{formatDate(u.createdAt, lang)}</td>
                <td>
                  <StatusBadge status={u.status} />
                </td>
                <td className="actions">
                  {u.status !== 'approved' && (
                    <button className="btn btn-sm btn-primary" onClick={() => setUserStatus(u, 'approved')}>
                      {u.status === 'suspended' ? t('reactivate') : t('approve')}
                    </button>
                  )}
                  {u.status !== 'suspended' && (
                    <button className="btn btn-sm" onClick={() => setUserStatus(u, 'suspended')}>
                      {t('suspend')}
                    </button>
                  )}
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      const password = prompt(t('newPasswordPrompt'));
                      if (!password) return;
                      run(() => api(`/users/${u.id}/password`, { method: 'POST', body: { password } }));
                    }}
                  >
                    {t('resetPassword')}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (!confirm(t('confirmDelete'))) return;
                      run(async () => {
                        await api(`/users/${u.id}`, { method: 'DELETE' });
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

      {creating && (
        <Modal title={t('newAccount')} onClose={() => setCreating(false)}>
          <Field label={t('email')}>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label={t('fullName')}>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </Field>
          <Field label={t('password')}>
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <div className="modal-actions">
            <button className="btn" onClick={() => setCreating(false)}>
              {t('cancel')}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || !form.email || !form.fullName || form.password.length < 6}
              onClick={() =>
                run(async () => {
                  await api('/users', { method: 'POST', body: form });
                  setCreating(false);
                  setForm({ email: '', fullName: '', password: '' });
                  load();
                })
              }
            >
              {t('create')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
