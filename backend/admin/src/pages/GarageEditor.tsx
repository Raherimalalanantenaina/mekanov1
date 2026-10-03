import { useEffect, useState } from 'react';
import { api, compressImage } from '../api';
import { useCatalog } from '../App';
import { useI18n } from '../i18n';
import type { GarageDetail, GarageStatus, PriceItem, UserItem } from '../types';
import { Check, Field, Modal, useAction } from '../ui';
import { MapPicker } from '../MapPicker';

type Draft = {
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  latitude: string;
  longitude: string;
  categories: string[];
  services: string[];
  other: string;
  photos: string[];
  mobileService: boolean;
  promo: string;
  priceList: PriceItem[];
  openingHours: string;
  isOpen: boolean;
  status: GarageStatus;
};

const blank: Draft = {
  name: '',
  description: '',
  address: '',
  city: '',
  phone: '',
  latitude: '-18.8792',
  longitude: '47.5079',
  categories: [],
  services: [],
  other: '',
  photos: [],
  mobileService: false,
  promo: '',
  priceList: [],
  openingHours: 'Lun–Sam 8h–18h',
  isOpen: true,
  status: 'approved',
};

/** Création (id = null) ou modification d'un garage par le super admin. */
export function GarageEditor({
  id,
  onClose,
  onSaved,
}: {
  id: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const { catalog } = useCatalog();
  const { run, busy } = useAction();
  const [draft, setDraft] = useState<Draft | null>(id ? null : blank);
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>('new');
  const [ownerId, setOwnerId] = useState('');
  const [owner, setOwner] = useState({ email: '', fullName: '', password: '' });
  const [users, setUsers] = useState<UserItem[]>([]);
  const [ownerLabel, setOwnerLabel] = useState('');

  const subtypeLabels = new Set(catalog.flatMap((c) => c.subtypes.map((s) => s.label)));

  useEffect(() => {
    if (id) {
      api<GarageDetail>(`/garages/${id}`).then((g) => {
        setOwnerLabel(`${g.ownerName ?? ''} — ${g.ownerEmail ?? ''}`);
        setDraft({
          name: g.name,
          description: g.description ?? '',
          address: g.address,
          city: g.city ?? '',
          phone: g.phone ?? '',
          latitude: String(g.latitude),
          longitude: String(g.longitude),
          categories: g.categories,
          services: g.services.filter((s) => subtypeLabels.has(s)),
          other: g.services.filter((s) => !subtypeLabels.has(s)).join(', '),
          photos: g.photos,
          mobileService: g.mobileService,
          promo: g.promo ?? '',
          priceList: g.priceList ?? [],
          openingHours: g.openingHours ?? '',
          isOpen: g.isOpen,
          status: g.status,
        });
      });
    } else {
      api<UserItem[]>('/users').then((list) => setUsers(list.filter((u) => !u.garageId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!draft) {
    return (
      <Modal title={t('editGarage')} onClose={onClose} wide>
        <div className="empty">{t('loading')}</div>
      </Modal>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });

  const toggleCategory = (catId: string) => {
    const has = draft.categories.includes(catId);
    if (has) {
      const removed = new Set(catalog.find((c) => c.id === catId)?.subtypes.map((s) => s.label));
      setDraft({
        ...draft,
        categories: draft.categories.filter((c) => c !== catId),
        services: draft.services.filter((s) => !removed.has(s)),
      });
    } else {
      setDraft({ ...draft, categories: [...draft.categories, catId] });
    }
  };

  const toggleService = (label: string) =>
    set('services', draft.services.includes(label) ? draft.services.filter((s) => s !== label) : [...draft.services, label]);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const added = await Promise.all(Array.from(files).map((f) => compressImage(f)));
    set('photos', [...draft.photos, ...added]);
  };

  const save = () =>
    run(async () => {
      const services = [
        ...draft.services,
        ...draft.other
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ];
      const body = {
        name: draft.name,
        description: draft.description,
        address: draft.address,
        city: draft.city,
        phone: draft.phone,
        latitude: Number(draft.latitude),
        longitude: Number(draft.longitude),
        categories: draft.categories,
        services,
        photos: draft.photos,
        mobileService: draft.mobileService,
        promo: draft.promo,
        priceList: draft.priceList.filter((p) => p.service.trim()),
        openingHours: draft.openingHours,
        isOpen: draft.isOpen,
        status: draft.status,
      };
      if (id) {
        await api(`/garages/${id}`, { method: 'PUT', body });
      } else {
        await api('/garages', {
          method: 'POST',
          body: { ...body, ...(ownerMode === 'existing' ? { ownerId } : { owner }) },
        });
      }
      onSaved();
    });

  const canSave =
    draft.name.trim() &&
    draft.address.trim() &&
    Number.isFinite(Number(draft.latitude)) &&
    Number.isFinite(Number(draft.longitude)) &&
    (id || (ownerMode === 'existing' ? ownerId : owner.email && owner.fullName && owner.password.length >= 6));

  return (
    <Modal title={id ? t('editGarage') : t('newGarage')} onClose={onClose} wide>
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>{t('owner')}</h3>
        {id ? (
          <div className="sub">{ownerLabel}</div>
        ) : (
          <>
            <div className="row" style={{ marginBottom: 10 }}>
              <label className="row">
                <input type="radio" style={{ width: 'auto' }} checked={ownerMode === 'new'} onChange={() => setOwnerMode('new')} />
                {t('ownerNew')}
              </label>
              <label className="row">
                <input
                  type="radio"
                  style={{ width: 'auto' }}
                  checked={ownerMode === 'existing'}
                  onChange={() => setOwnerMode('existing')}
                />
                {t('ownerExisting')}
              </label>
            </div>
            {ownerMode === 'existing' ? (
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} — {u.email}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-3">
                <Field label={t('email')}>
                  <input type="email" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
                </Field>
                <Field label={t('fullName')}>
                  <input value={owner.fullName} onChange={(e) => setOwner({ ...owner, fullName: e.target.value })} />
                </Field>
                <Field label={t('password')}>
                  <input value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} />
                </Field>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-2">
        <Field label={`${t('name')} *`}>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('status')}>
          <select value={draft.status} onChange={(e) => set('status', e.target.value as GarageStatus)}>
            <option value="approved">{t('st_approved')}</option>
            <option value="pending">{t('st_pending')}</option>
            <option value="hidden">{t('st_hidden')}</option>
          </select>
        </Field>
        <Field label={`${t('address')} *`}>
          <input value={draft.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label={t('city')}>
          <input value={draft.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label={t('phone')}>
          <input value={draft.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label={t('openingHours')}>
          <input value={draft.openingHours} onChange={(e) => set('openingHours', e.target.value)} />
        </Field>
        <Field label={`${t('latitude')} *`}>
          <input value={draft.latitude} onChange={(e) => set('latitude', e.target.value)} />
        </Field>
        <Field label={`${t('longitude')} *`}>
          <input value={draft.longitude} onChange={(e) => set('longitude', e.target.value)} />
        </Field>
      </div>

      <div>
        <div className="field-label" style={{ marginBottom: 8 }}>
          {t('location')} *
        </div>
        <MapPicker
          latitude={Number(draft.latitude) || -18.8792}
          longitude={Number(draft.longitude) || 47.5079}
          onChange={(lat, lng) => setDraft((d) => (d ? { ...d, latitude: lat.toFixed(6), longitude: lng.toFixed(6) } : d))}
        />
      </div>

      <Field label={t('description')}>
        <textarea value={draft.description} onChange={(e) => set('description', e.target.value)} />
      </Field>

      <div>
        <div className="field-label" style={{ marginBottom: 8 }}>
          {t('types')}
        </div>
        {catalog.map((c) => {
          const on = draft.categories.includes(c.id);
          return (
            <div key={c.id} style={{ marginBottom: 6 }}>
              <Check checked={on} onChange={() => toggleCategory(c.id)} label={`${c.emoji} ${(lang === 'mg' && c.labelMg) || c.label}`} />
              {on && (
                <div style={{ paddingLeft: 46, marginTop: 4 }}>
                  {c.subtypes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="chip"
                      style={{
                        border: 'none',
                        cursor: 'pointer',
                        background: draft.services.includes(s.label) ? 'var(--teal)' : undefined,
                        color: draft.services.includes(s.label) ? '#fff' : undefined,
                      }}
                      onClick={() => toggleService(s.label)}
                    >
                      {(lang === 'mg' && s.labelMg) || s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Field label={t('otherServices')}>
        <input value={draft.other} onChange={(e) => set('other', e.target.value)} />
      </Field>

      <div>
        <div className="field-label" style={{ marginBottom: 8 }}>
          {t('photos')} ({draft.photos.length})
        </div>
        <div className="photos">
          {draft.photos.map((p, i) => (
            <div key={i} className="photo">
              <img src={p} alt="" />
              <button type="button" onClick={() => set('photos', draft.photos.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <label className="btn btn-sm" style={{ alignSelf: 'center' }}>
            + {t('addPhotos')}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          </label>
        </div>
      </div>

      <div className="grid grid-2">
        <Field label={t('promo')}>
          <input value={draft.promo} onChange={(e) => set('promo', e.target.value)} />
        </Field>
        <div className="row" style={{ paddingTop: 22, gap: 20 }}>
          <Check checked={draft.mobileService} onChange={(v) => set('mobileService', v)} label={t('mobileService')} />
          <Check checked={draft.isOpen} onChange={(v) => set('isOpen', v)} label={t('isOpen')} />
        </div>
      </div>

      <div>
        <div className="field-label" style={{ marginBottom: 8 }}>
          {t('prices')}
        </div>
        {draft.priceList.map((p, i) => (
          <div key={i} className="row" style={{ marginBottom: 6, flexWrap: 'nowrap' }}>
            <input
              placeholder={t('priceService')}
              value={p.service}
              onChange={(e) => set('priceList', draft.priceList.map((x, j) => (j === i ? { ...x, service: e.target.value } : x)))}
            />
            <input
              placeholder={t('price')}
              value={p.price}
              style={{ maxWidth: 160 }}
              onChange={(e) => set('priceList', draft.priceList.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
            />
            <button className="btn-icon" onClick={() => set('priceList', draft.priceList.filter((_, j) => j !== i))}>
              🗑
            </button>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => set('priceList', [...draft.priceList, { service: '', price: '' }])}>
          + {t('add')}
        </button>
      </div>

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          {t('cancel')}
        </button>
        <button className="btn btn-primary" disabled={busy || !canSave} onClick={save}>
          {id ? t('save') : t('create')}
        </button>
      </div>
    </Modal>
  );
}
