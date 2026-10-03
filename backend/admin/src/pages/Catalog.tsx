import { useState } from 'react';
import { api } from '../api';
import { useCatalog } from '../App';
import { useI18n } from '../i18n';
import type { Category, Subtype } from '../types';
import { Check, Field, IconButton, Modal, PageHead, useAction, useConfirmDelete } from '../ui';
import {
  mdiArrowDown,
  mdiArrowUp,
  mdiChevronDown,
  mdiChevronUp,
  mdiContentSave,
  mdiPencilOutline,
  mdiPlus,
  mdiShapeOutline,
  mdiTrashCanOutline,
} from '@mdi/js';
import { CATEGORY_ICONS, CategoryIcon, MdiIcon } from '../CategoryIcon';

type CategoryDraft = { icon: string; label: string; labelMg: string; keywords: string; active: boolean };

const emptyDraft: CategoryDraft = { icon: 'wrench', label: '', labelMg: '', keywords: '', active: true };

function SubtypeRow({
  sub,
  first,
  last,
  onMove,
  onSaved,
}: {
  sub: Subtype;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onSaved: (c: Category[]) => void;
}) {
  const { t } = useI18n();
  const { run, busy } = useAction();
  const confirmDelete = useConfirmDelete();
  const [label, setLabel] = useState(sub.label);
  const [labelMg, setLabelMg] = useState(sub.labelMg);
  const dirty = label !== sub.label || labelMg !== sub.labelMg;

  const save = (patch: Partial<Subtype>) =>
    run(async () => {
      onSaved(await api<Category[]>(`/catalog/subtypes/${sub.id}`, { method: 'PUT', body: patch }));
    });

  return (
    <div className="subtype-row">
      <IconButton icon={mdiArrowUp} size={16} disabled={first} onClick={() => onMove(-1)} label={t('moveUp')} />
      <IconButton icon={mdiArrowDown} size={16} disabled={last} onClick={() => onMove(1)} label={t('moveDown')} />
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('labelFr')} />
      <input value={labelMg} onChange={(e) => setLabelMg(e.target.value)} placeholder={t('labelMg')} />
      {dirty && (
        <IconButton
          icon={mdiContentSave}
          tone="success"
          disabled={busy || !label.trim()}
          onClick={() => save({ label, labelMg })}
          label={t('save')}
        />
      )}
      <Check checked={sub.active} onChange={(active) => save({ active })} />
      <IconButton
        icon={mdiTrashCanOutline}
        tone="danger"
        label={t('delete')}
        onClick={async () => {
          if (!(await confirmDelete(t('deleteSubtypeConfirm')))) return;
          run(async () => {
            await api(`/catalog/subtypes/${sub.id}`, { method: 'DELETE' });
            onSaved(await api<Category[]>('/catalog'));
          }, 'deleted');
        }}
      />
    </div>
  );
}

export function Catalog() {
  const { t, lang } = useI18n();
  const { catalog, setCatalog } = useCatalog();
  const { run, busy } = useAction();
  const confirmDelete = useConfirmDelete();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: CategoryDraft } | null>(null);
  const [newSub, setNewSub] = useState<Record<string, { label: string; labelMg: string }>>({});

  const replaceCategory = (cat: Category) =>
    setCatalog(catalog.some((c) => c.id === cat.id) ? catalog.map((c) => (c.id === cat.id ? cat : c)) : [...catalog, cat]);

  const moveCategory = (index: number, dir: -1 | 1) => {
    const ids = catalog.map((c) => c.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    run(async () => setCatalog(await api<Category[]>('/catalog/order', { method: 'PUT', body: { ids } })), null);
  };

  const moveSubtype = (cat: Category, index: number, dir: -1 | 1) => {
    const ids = cat.subtypes.map((s) => s.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    run(
      async () =>
        setCatalog(await api<Category[]>(`/catalog/categories/${cat.id}/subtypes/order`, { method: 'PUT', body: { ids } })),
      null
    );
  };

  const saveCategory = () => {
    if (!editing) return;
    const body = { ...editing.draft, keywords: editing.draft.keywords };
    run(async () => {
      const cat = editing.id
        ? await api<Category>(`/catalog/categories/${editing.id}`, { method: 'PUT', body })
        : await api<Category>('/catalog/categories', { method: 'POST', body });
      replaceCategory(cat);
      setEditing(null);
      setOpen(cat.id);
    });
  };

  const addSubtype = (cat: Category) => {
    const draft = newSub[cat.id];
    if (!draft?.label.trim()) return;
    run(async () => {
      replaceCategory(
        await api<Category>(`/catalog/categories/${cat.id}/subtypes`, { method: 'POST', body: draft })
      );
      setNewSub({ ...newSub, [cat.id]: { label: '', labelMg: '' } });
    });
  };

  return (
    <>
      <PageHead title={t('navCatalog')} hint={t('catalogHint')} icon={mdiShapeOutline}>
        <button className="btn btn-primary" onClick={() => setEditing({ id: null, draft: emptyDraft })}>
          <MdiIcon path={mdiPlus} size={18} /> {t('newCategory')}
        </button>
      </PageHead>

      {catalog.map((cat, i) => (
        <div key={cat.id} className={`category ${cat.active ? '' : 'off'}`}>
          <div className="category-head">
            <div className="move-btns">
              <button className="btn-icon" disabled={i === 0} onClick={() => moveCategory(i, -1)} aria-label={t('moveUp')}>
                <MdiIcon path={mdiChevronUp} size={18} />
              </button>
              <button
                className="btn-icon"
                disabled={i === catalog.length - 1}
                onClick={() => moveCategory(i, 1)}
                aria-label={t('moveDown')}
              >
                <MdiIcon path={mdiChevronDown} size={18} />
              </button>
            </div>
            <span className="cat-icon">
              <CategoryIcon name={cat.icon} size={22} />
            </span>
            <div className="title">
              <strong>{(lang === 'mg' && cat.labelMg) || cat.label}</strong>
              <div className="sub">
                {cat.labelMg && lang !== 'mg' ? `${cat.labelMg} · ` : ''}
                {cat.subtypes.length} {t('subtypes').toLowerCase()} · {cat.keywords.slice(0, 6).join(', ')}
              </div>
            </div>
            <Check
              checked={cat.active}
              label={cat.active ? t('active') : t('inactive')}
              onChange={(active) =>
                run(async () =>
                  replaceCategory(await api<Category>(`/catalog/categories/${cat.id}`, { method: 'PUT', body: { active } }))
                )
              }
            />
            <button className="btn btn-sm" onClick={() => setOpen(open === cat.id ? null : cat.id)}>
              {t('subtypes')} ({cat.subtypes.length})
              <MdiIcon path={open === cat.id ? mdiChevronUp : mdiChevronDown} size={16} />
            </button>
            <IconButton
              icon={mdiPencilOutline}
              tone="primary"
              label={t('edit')}
              onClick={() =>
                setEditing({
                  id: cat.id,
                  draft: {
                    icon: cat.icon,
                    label: cat.label,
                    labelMg: cat.labelMg,
                    keywords: cat.keywords.join(', '),
                    active: cat.active,
                  },
                })
              }
            />
            <IconButton
              icon={mdiTrashCanOutline}
              tone="danger"
              label={t('delete')}
              onClick={async () => {
                if (!(await confirmDelete(t('deleteCategoryConfirm')))) return;
                run(async () => {
                  await api(`/catalog/categories/${cat.id}`, { method: 'DELETE' });
                  setCatalog(catalog.filter((c) => c.id !== cat.id));
                }, 'deleted');
              }}
            />
          </div>

          {open === cat.id && (
            <div className="category-body">
              {cat.subtypes.map((sub, j) => (
                <SubtypeRow
                  key={`${sub.id}-${sub.label}-${sub.labelMg}`}
                  sub={sub}
                  first={j === 0}
                  last={j === cat.subtypes.length - 1}
                  onMove={(dir) => moveSubtype(cat, j, dir)}
                  onSaved={setCatalog}
                />
              ))}
              <div className="subtype-row">
                <span style={{ width: 68, display: 'inline-flex', justifyContent: 'center', color: 'var(--teal)' }}>
                  <MdiIcon path={mdiPlus} size={18} />
                </span>
                <input
                  placeholder={`${t('newSubtype')} — ${t('labelFr')}`}
                  value={newSub[cat.id]?.label ?? ''}
                  onChange={(e) =>
                    setNewSub({ ...newSub, [cat.id]: { labelMg: newSub[cat.id]?.labelMg ?? '', label: e.target.value } })
                  }
                  onKeyDown={(e) => e.key === 'Enter' && addSubtype(cat)}
                />
                <input
                  placeholder={t('labelMg')}
                  value={newSub[cat.id]?.labelMg ?? ''}
                  onChange={(e) =>
                    setNewSub({ ...newSub, [cat.id]: { label: newSub[cat.id]?.label ?? '', labelMg: e.target.value } })
                  }
                  onKeyDown={(e) => e.key === 'Enter' && addSubtype(cat)}
                />
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => addSubtype(cat)}>
                  <MdiIcon path={mdiPlus} size={16} /> {t('add')}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {editing && (
        <Modal
          title={editing.id ? t('edit') : t('newCategory')}
          onClose={() => setEditing(null)}
          icon={editing.id ? mdiPencilOutline : mdiPlus}
        >
          <Field label={t('labelFr')}>
            <input
              value={editing.draft.label}
              onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, label: e.target.value } })}
              autoFocus
            />
          </Field>
          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>
              {t('icon')}
            </div>
            <div className="icon-grid">
              {CATEGORY_ICONS.map((ic) => (
                <button
                  key={ic.name}
                  type="button"
                  title={ic.label}
                  className={`icon-option ${editing.draft.icon === ic.name ? 'on' : ''}`}
                  onClick={() => setEditing({ ...editing, draft: { ...editing.draft, icon: ic.name } })}
                >
                  <CategoryIcon name={ic.name} size={22} />
                </button>
              ))}
            </div>
          </div>
          <Field label={t('labelMg')}>
            <input
              value={editing.draft.labelMg}
              onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, labelMg: e.target.value } })}
            />
          </Field>
          <Field label={t('keywords')} hint={t('keywordsHint')}>
            <textarea
              value={editing.draft.keywords}
              onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, keywords: e.target.value } })}
            />
          </Field>
          <Check
            checked={editing.draft.active}
            label={t('active')}
            onChange={(active) => setEditing({ ...editing, draft: { ...editing.draft, active } })}
          />
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(null)}>
              {t('cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy || !editing.draft.label.trim()} onClick={saveCategory}>
              <MdiIcon path={editing.id ? mdiContentSave : mdiPlus} size={17} />
              {editing.id ? t('save') : t('create')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
