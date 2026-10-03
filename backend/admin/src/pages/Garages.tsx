import { useCallback, useEffect, useState } from 'react';
import {
  mdiAccountCancelOutline,
  mdiAccountCheckOutline,
  mdiAccountOutline,
  mdiCheck,
  mdiCheckDecagramOutline,
  mdiCloseCircleOutline,
  mdiCrownOutline,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiGarageVariant,
  mdiImageMultipleOutline,
  mdiKeyVariant,
  mdiMagnify,
  mdiMapMarkerOutline,
  mdiPencilOutline,
  mdiPhoneOutline,
  mdiPlus,
  mdiStar,
  mdiStorePlusOutline,
  mdiTrashCanOutline,
  mdiEyeCircleOutline,
} from '@mdi/js';
import { api } from '../api';
import { hashParams, useCatalog, useRefreshCounts } from '../App';
import { useI18n } from '../i18n';
import { PLAN_IDS, type GarageListItem, type GarageStatus, type PlanId, type UserItem, type UserStatus } from '../types';
import {
  addMonths,
  Avatar,
  EmptyState,
  formatDate,
  formatDay,
  IconButton,
  Loader,
  PageHead,
  PlanBadge,
  StatusBadge,
  useAction,
  useConfirm,
} from '../ui';
import { useAppConfig } from '../useAppConfig';
import { CategoryIcon, MdiIcon } from '../CategoryIcon';
import { GarageEditor } from './GarageEditor';

type Tab = 'garages' | 'accounts';

export function Garages() {
  const { t, lang } = useI18n();
  const { catalog } = useCatalog();
  const refreshCounts = useRefreshCounts();
  const confirm = useConfirm();
  const { run } = useAction();
  const initial = hashParams();
  const [tab, setTab] = useState<Tab>(initial.get('tab') === 'accounts' ? 'accounts' : 'garages');
  const [list, setList] = useState<GarageListItem[] | null>(null);
  const [orphans, setOrphans] = useState<UserItem[] | null>(null);
  const [status, setStatus] = useState(initial.get('status') ?? '');
  const [category, setCategory] = useState('');
  const [plan, setPlan] = useState(initial.get('plan') ?? '');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ id: string | null; ownerId?: string } | null>(null);
  const { config } = useAppConfig();
  const planName = (id: PlanId) =>
    (config && ((lang === 'mg' && config.plans[id].name.mg) || config.plans[id].name.fr)) || id;

  const loadGarages = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (plan === 'request') params.set('planRequest', '1');
    else if (plan) params.set('plan', plan);
    if (q.trim()) params.set('q', q.trim());
    api<GarageListItem[]>(`/garages?${params}`).then(setList);
  }, [status, category, plan, q]);

  const loadOrphans = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    api<UserItem[]>(`/users?${params}`).then((users) => setOrphans(users.filter((u) => !u.garageId)));
  }, [q]);

  const reload = () => {
    loadGarages();
    loadOrphans();
    refreshCounts();
  };

  useEffect(() => {
    const timer = setTimeout(loadGarages, 250);
    return () => clearTimeout(timer);
  }, [loadGarages]);

  useEffect(() => {
    const timer = setTimeout(loadOrphans, 250);
    return () => clearTimeout(timer);
  }, [loadOrphans]);

  // ─── Actions garage ───

  const setGarageStatus = (g: GarageListItem, next: GarageStatus) =>
    run(async () => {
      await api(`/garages/${g.id}`, { method: 'PUT', body: { status: next } });
      reload();
    }, next === 'approved' ? 'garageApproved' : next === 'hidden' ? 'garageHidden' : 'saved');

  const activatePlan = (g: GarageListItem, next: PlanId) =>
    run(async () => {
      await api(`/garages/${g.id}`, {
        method: 'PUT',
        body: {
          plan: next,
          planExpiresAt: next === 'free' ? null : addMonths(g.paidPlan === next ? g.planExpiresAt : null, 1),
        },
      });
      reload();
    }, 'planActivated');

  const ignoreRequest = (g: GarageListItem) =>
    run(async () => {
      await api(`/garages/${g.id}`, { method: 'PUT', body: { clearPlanRequest: true } });
      reload();
    });

  const deleteGarage = async (g: GarageListItem) => {
    const res = await confirm({
      title: t('deleteGarageTitle'),
      message: `${g.name} — ${t('confirmDelete')}`,
      confirmLabel: t('delete'),
      danger: true,
      icon: mdiTrashCanOutline,
      checkbox: { label: t('alsoDeleteAccount'), defaultChecked: true },
    });
    if (!res) return;
    run(async () => {
      await api(res.checked ? `/users/${g.ownerId}` : `/garages/${g.id}`, { method: 'DELETE' });
      reload();
    }, 'deleted');
  };

  // ─── Actions compte ───

  const setUserStatus = async (userId: string, name: string, next: UserStatus) => {
    if (next === 'suspended') {
      const ok = await confirm({
        title: t('suspendTitle'),
        message: `${name} — ${t('suspendHint')}`,
        confirmLabel: t('suspend'),
        danger: true,
        icon: mdiAccountCancelOutline,
      });
      if (!ok) return;
    }
    run(async () => {
      await api(`/users/${userId}`, { method: 'PUT', body: { status: next } });
      reload();
    }, next === 'suspended' ? 'accountSuspended' : 'accountReactivated');
  };

  const resetPassword = async (userId: string, name: string) => {
    const res = await confirm({
      title: t('resetPassword'),
      message: name,
      icon: mdiKeyVariant,
      input: { label: t('newPasswordPrompt'), minLength: 6 },
      confirmLabel: t('save'),
    });
    if (!res) return;
    run(() => api(`/users/${userId}/password`, { method: 'POST', body: { password: res.value } }), 'passwordChanged');
  };

  const deleteUser = async (u: UserItem) => {
    const ok = await confirm({
      title: t('deleteTitle'),
      message: `${u.fullName} — ${t('confirmDelete')}`,
      confirmLabel: t('delete'),
      danger: true,
      icon: mdiTrashCanOutline,
    });
    if (!ok) return;
    run(async () => {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      reload();
    }, 'deleted');
  };

  const catOf = (id: string) => catalog.find((x) => x.id === id);
  const catName = (id: string) => {
    const c = catOf(id);
    return c ? (lang === 'mg' && c.labelMg) || c.label : id;
  };
  const pendingOrphans = orphans?.filter((u) => u.status === 'pending').length ?? 0;

  return (
    <>
      <PageHead title={t('navGarages')} icon={mdiGarageVariant}>
        <button className="btn btn-primary" onClick={() => setEditing({ id: null })}>
          <MdiIcon path={mdiPlus} size={18} /> {t('newGarage')}
        </button>
      </PageHead>

      <div className="tabs">
        <button className={tab === 'garages' ? 'on' : ''} onClick={() => setTab('garages')}>
          <MdiIcon path={mdiGarageVariant} size={17} /> {t('tabGarages')}
          {list && <span className="sub">{list.length}</span>}
        </button>
        <button className={tab === 'accounts' ? 'on' : ''} onClick={() => setTab('accounts')}>
          <MdiIcon path={mdiAccountOutline} size={17} /> {t('tabOrphanAccounts')}
          {pendingOrphans > 0 ? (
            <span className="tab-count">{pendingOrphans}</span>
          ) : (
            orphans && <span className="sub">{orphans.length}</span>
          )}
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <MdiIcon path={mdiMagnify} size={18} />
          <input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {tab === 'garages' && (
          <>
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
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="">
                {t('plan')}: {t('all')}
              </option>
              <option value="request">{t('planRequests')}</option>
              {PLAN_IDS.map((id) => (
                <option key={id} value={id}>
                  {planName(id)}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {tab === 'garages' ? (
        <div className="card card-flush">
          <table>
            <thead>
              <tr>
                <th>{t('garage')}</th>
                <th>{t('owner')}</th>
                <th>{t('types')}</th>
                <th>{t('plan')}</th>
                <th>{t('status')}</th>
                <th style={{ textAlign: 'right' }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list?.map((g) => {
                const cat = catOf(g.categories[0]);
                return (
                  <tr key={g.id}>
                    <td>
                      <div className="cell-main">
                        <span className="thumb">
                          <CategoryIcon name={cat?.icon} size={22} />
                        </span>
                        <div>
                          <strong>{g.name}</strong>
                          <div className="meta">
                            <span>
                              <MdiIcon path={mdiMapMarkerOutline} size={13} /> {g.city || g.address}
                            </span>
                            {g.phone && (
                              <span>
                                <MdiIcon path={mdiPhoneOutline} size={13} /> {g.phone}
                              </span>
                            )}
                          </div>
                          <div className="meta">
                            <span data-tip={t('views')}>
                              <MdiIcon path={mdiEyeCircleOutline} size={13} /> {g.views}
                            </span>
                            <span data-tip={t('calls')}>
                              <MdiIcon path={mdiPhoneOutline} size={13} /> {g.calls}
                            </span>
                            <span data-tip={t('photoCount')}>
                              <MdiIcon path={mdiImageMultipleOutline} size={13} /> {g.photoCount}
                            </span>
                            {g.rating != null && (
                              <span style={{ color: '#d48806' }}>
                                <MdiIcon path={mdiStar} size={13} /> {g.rating}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-main" style={{ minWidth: 180 }}>
                        <Avatar name={g.ownerName || g.ownerEmail} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: 13.5 }}>{g.ownerName}</strong>
                          <div className="sub">{g.ownerEmail}</div>
                          {g.ownerStatus !== 'approved' && <StatusBadge status={g.ownerStatus} />}
                        </div>
                      </div>
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      {g.categories.map((c) => (
                        <span key={c} className="chip">
                          <CategoryIcon name={catOf(c)?.icon} size={14} />
                          {catName(c)}
                        </span>
                      ))}
                      {g.services.length > 0 && (
                        <div className="sub" style={{ marginTop: 3 }}>
                          {g.services.slice(0, 3).join(', ')}
                          {g.services.length > 3 ? ` +${g.services.length - 3}` : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <PlanBadge plan={g.plan} name={planName(g.plan)} />
                      {g.planExpiresAt && g.paidPlan !== 'free' && (
                        <div className="sub" style={{ marginTop: 3 }}>
                          {g.planExpired
                            ? `${planName(g.paidPlan)} · ${t('planExpired')}`
                            : t('planUntil', { d: formatDay(g.planExpiresAt, lang) })}
                        </div>
                      )}
                      {g.planRequest && (
                        <div>
                          <div className="plan-request">
                            <MdiIcon path={mdiCrownOutline} size={13} />
                            {t('planRequested', { p: planName(g.planRequest) })}
                          </div>
                          <div className="actions-group" style={{ marginTop: 4 }}>
                            <IconButton
                              icon={mdiCheck}
                              tone="success"
                              label={`${t('planActivate', { p: planName(g.planRequest) })} (${t('plusMonths', { n: 1 })})`}
                              onClick={() => activatePlan(g, g.planRequest!)}
                            />
                            <IconButton
                              icon={mdiCloseCircleOutline}
                              tone="danger"
                              label={t('planIgnore')}
                              onClick={() => ignoreRequest(g)}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="actions">
                      <div className="actions-group">
                        {g.status !== 'approved' && (
                          <IconButton
                            icon={mdiCheckDecagramOutline}
                            tone="success"
                            label={t('approveAll')}
                            onClick={() => setGarageStatus(g, 'approved')}
                          />
                        )}
                        {g.status === 'hidden' ? (
                          <IconButton
                            icon={mdiEyeOutline}
                            tone="primary"
                            label={t('st_approved')}
                            onClick={() => setGarageStatus(g, 'approved')}
                          />
                        ) : (
                          <IconButton
                            icon={mdiEyeOffOutline}
                            tone="warning"
                            label={t('hide')}
                            onClick={() => setGarageStatus(g, 'hidden')}
                          />
                        )}
                        <IconButton
                          icon={mdiPencilOutline}
                          tone="primary"
                          label={t('edit')}
                          onClick={() => setEditing({ id: g.id })}
                        />
                        <span className="actions-sep" />
                        <IconButton
                          icon={mdiKeyVariant}
                          label={t('resetPassword')}
                          onClick={() => resetPassword(g.ownerId, g.ownerName)}
                        />
                        {g.ownerStatus === 'suspended' ? (
                          <IconButton
                            icon={mdiAccountCheckOutline}
                            tone="success"
                            label={t('reactivate')}
                            onClick={() => setUserStatus(g.ownerId, g.ownerName, 'approved')}
                          />
                        ) : (
                          <IconButton
                            icon={mdiAccountCancelOutline}
                            tone="warning"
                            label={`${t('suspend')} (${t('accountLabel').toLowerCase()})`}
                            onClick={() => setUserStatus(g.ownerId, g.ownerName, 'suspended')}
                          />
                        )}
                        <IconButton
                          icon={mdiTrashCanOutline}
                          tone="danger"
                          label={t('delete')}
                          onClick={() => deleteGarage(g)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list && list.length === 0 && <EmptyState text={t('noResults')} icon={mdiGarageVariant} />}
          {!list && <Loader />}
        </div>
      ) : (
        <>
          <div className="notice">
            <MdiIcon path={mdiAccountOutline} size={18} />
            {t('orphanHint')}
          </div>
          <div className="card card-flush">
            <table>
              <thead>
                <tr>
                  <th>{t('fullName')}</th>
                  <th>{t('createdAt')}</th>
                  <th>{t('status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {orphans?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-main">
                        <Avatar name={u.fullName || u.email} size={36} />
                        <div>
                          <strong>{u.fullName}</strong>
                          <div className="sub">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="sub">{formatDate(u.createdAt, lang)}</td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="actions">
                      <div className="actions-group">
                        <IconButton
                          icon={mdiStorePlusOutline}
                          tone="primary"
                          label={t('createGarageFor')}
                          onClick={() => setEditing({ id: null, ownerId: u.id })}
                        />
                        {u.status !== 'approved' && (
                          <IconButton
                            icon={mdiAccountCheckOutline}
                            tone="success"
                            label={u.status === 'suspended' ? t('reactivate') : t('approve')}
                            onClick={() => setUserStatus(u.id, u.fullName, 'approved')}
                          />
                        )}
                        {u.status !== 'suspended' && (
                          <IconButton
                            icon={mdiAccountCancelOutline}
                            tone="warning"
                            label={t('suspend')}
                            onClick={() => setUserStatus(u.id, u.fullName, 'suspended')}
                          />
                        )}
                        <IconButton
                          icon={mdiKeyVariant}
                          label={t('resetPassword')}
                          onClick={() => resetPassword(u.id, u.fullName)}
                        />
                        <IconButton
                          icon={mdiTrashCanOutline}
                          tone="danger"
                          label={t('delete')}
                          onClick={() => deleteUser(u)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orphans && orphans.length === 0 && <EmptyState text={t('noResults')} icon={mdiAccountOutline} />}
            {!orphans && <Loader />}
          </div>
        </>
      )}

      {editing && (
        <GarageEditor
          id={editing.id}
          presetOwnerId={editing.ownerId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
