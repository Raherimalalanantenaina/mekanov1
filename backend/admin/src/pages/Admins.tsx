import { useCallback, useEffect, useState } from 'react';
import {
  mdiAccountCancelOutline,
  mdiAccountCheckOutline,
  mdiAccountKeyOutline,
  mdiAccountPlusOutline,
  mdiContentSave,
  mdiDeleteOutline,
  mdiDiceMultipleOutline,
  mdiPencilOutline,
  mdiPlus,
  mdiShieldAccountOutline,
} from '@mdi/js';
import { api } from '../api';
import { useI18n, type TKey } from '../i18n';
import { ADMIN_PERMISSIONS, type AdminAccount, type AdminPermission } from '../types';
import { MdiIcon } from '../CategoryIcon';
import {
  Avatar,
  Check,
  EmptyState,
  Field,
  IconButton,
  Loader,
  Modal,
  PageHead,
  timeAgo,
  useAction,
  useConfirm,
} from '../ui';

type Draft = {
  id: string | null;
  fullName: string;
  email: string;
  password: string;
  permissions: AdminPermission[];
  active: boolean;
};

const emptyDraft: Draft = {
  id: null,
  fullName: '',
  email: '',
  password: '',
  permissions: ['garages', 'moderation'],
  active: true,
};

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function Admins() {
  const { t, lang } = useI18n();
  const confirm = useConfirm();
  const { busy, run } = useAction();
  const [list, setList] = useState<AdminAccount[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(() => {
    api<AdminAccount[]>('/admins').then(setList).catch(() => setList([]));
  }, []);

  useEffect(load, [load]);

  const permLabel = (p: AdminPermission) => t(`perm_${p}` as TKey);

  const save = () =>
    draft &&
    run(async () => {
      const body = {
        fullName: draft.fullName,
        email: draft.email,
        permissions: draft.permissions,
        active: draft.active,
        ...(draft.password ? { password: draft.password } : {}),
      };
      if (draft.id) await api(`/admins/${draft.id}`, { method: 'PUT', body });
      else await api('/admins', { method: 'POST', body });
      setDraft(null);
      load();
    }, draft.id ? 'saved' : 'adminCreated');

  const toggleActive = (a: AdminAccount) =>
    run(async () => {
      await api(`/admins/${a.id}`, { method: 'PUT', body: { active: !a.active } });
      load();
    });

  const remove = async (a: AdminAccount) => {
    const ok = await confirm({
      title: t('adminDeleteTitle'),
      message: t('adminDeleteText', { name: a.fullName }),
      confirmLabel: t('delete'),
      danger: true,
      icon: mdiDeleteOutline,
    });
    if (!ok) return;
    run(async () => {
      await api(`/admins/${a.id}`, { method: 'DELETE' });
      load();
    }, 'deleted');
  };

  const togglePerm = (p: AdminPermission, on: boolean) =>
    draft &&
    setDraft({
      ...draft,
      permissions: on ? [...draft.permissions, p] : draft.permissions.filter((x) => x !== p),
    });

  const canSave =
    !!draft &&
    draft.fullName.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) &&
    (draft.id ? draft.password === '' || draft.password.length >= 8 : draft.password.length >= 8);

  return (
    <>
      <PageHead title={t('navAdmins')} hint={t('adminsHint')} icon={mdiShieldAccountOutline}>
        <button className="btn btn-primary" onClick={() => setDraft({ ...emptyDraft, password: randomPassword() })}>
          <MdiIcon path={mdiAccountPlusOutline} size={18} /> {t('newAdmin')}
        </button>
      </PageHead>

      {!list ? (
        <Loader />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState text={t('noAdmins')} icon={mdiShieldAccountOutline} />
        </div>
      ) : (
        <div className="card card-flush">
          <table>
            <thead>
              <tr>
                <th>{t('roleAdmin')}</th>
                <th>{t('adminAccess')}</th>
                <th>{t('lastLogin')}</th>
                <th>{t('status')}</th>
                <th style={{ textAlign: 'right' }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className={a.active ? '' : 'row-muted'}>
                  <td>
                    <div className="cell-main">
                      <Avatar name={a.fullName} size={36} />
                      <div>
                        <strong>{a.fullName}</strong>
                        <div className="sub">{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="perm-chips">
                      {a.permissions.length === 0 ? (
                        <span className="sub">{t('adminNoAccess')}</span>
                      ) : (
                        a.permissions.map((p) => (
                          <span key={p} className="perm-chip">
                            {permLabel(p)}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="sub">{a.lastLoginAt ? timeAgo(a.lastLoginAt, lang) : t('never')}</td>
                  <td>
                    <span className={`badge ${a.active ? 'badge-approved' : 'badge-suspended'}`}>
                      <i />
                      {a.active ? t('active') : t('adminDisabled')}
                    </span>
                  </td>
                  <td className="actions">
                    <div className="actions-group">
                      <IconButton
                        icon={mdiPencilOutline}
                        label={t('edit')}
                        onClick={() =>
                          setDraft({
                            id: a.id,
                            fullName: a.fullName,
                            email: a.email,
                            password: '',
                            permissions: a.permissions,
                            active: a.active,
                          })
                        }
                      />
                      <IconButton
                        icon={a.active ? mdiAccountCancelOutline : mdiAccountCheckOutline}
                        tone={a.active ? 'warning' : 'success'}
                        label={a.active ? t('adminDisable') : t('adminEnable')}
                        disabled={busy}
                        onClick={() => toggleActive(a)}
                      />
                      <IconButton
                        icon={mdiDeleteOutline}
                        tone="danger"
                        label={t('delete')}
                        disabled={busy}
                        onClick={() => remove(a)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Modal
          title={draft.id ? t('editAdmin') : t('newAdmin')}
          onClose={() => setDraft(null)}
          icon={draft.id ? mdiPencilOutline : mdiAccountPlusOutline}
        >
          <Field label={t('adminName')}>
            <input
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label={t('email')}>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
          <Field label={t('adminPassword')} hint={draft.id ? t('adminPasswordKeep') : t('adminPasswordHint')}>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                autoComplete="new-password"
                style={{ fontFamily: 'monospace' }}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setDraft({ ...draft, password: randomPassword() })}
              >
                <MdiIcon path={mdiDiceMultipleOutline} size={15} /> {t('generatePassword')}
              </button>
            </div>
          </Field>

          <div>
            <div className="section-title" style={{ marginBottom: 4 }}>
              <MdiIcon path={mdiAccountKeyOutline} size={18} /> {t('adminAccess')}
              <button
                type="button"
                className="link-btn"
                style={{ marginLeft: 'auto' }}
                onClick={() => setDraft({ ...draft, permissions: [...ADMIN_PERMISSIONS] })}
              >
                {t('adminAllAccess')}
              </button>
            </div>
            <div className="field-hint" style={{ marginBottom: 10 }}>
              {t('adminAccessHint')}
            </div>
            <div className="perm-grid">
              {ADMIN_PERMISSIONS.map((p) => (
                <Check
                  key={p}
                  checked={draft.permissions.includes(p)}
                  label={permLabel(p)}
                  onChange={(on) => togglePerm(p, on)}
                />
              ))}
            </div>
          </div>

          <Check
            checked={draft.active}
            label={t('adminActive')}
            onChange={(active) => setDraft({ ...draft, active })}
          />

          <div className="modal-actions">
            <button className="btn" onClick={() => setDraft(null)}>
              {t('cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy || !canSave} onClick={save}>
              <MdiIcon path={draft.id ? mdiContentSave : mdiPlus} size={17} />
              {draft.id ? t('save') : t('create')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
