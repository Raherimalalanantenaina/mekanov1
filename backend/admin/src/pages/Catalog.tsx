import { useState } from 'react';
import { api } from '../api';
import { useCatalog } from '../App';
import { useI18n } from '../i18n';
import type { Category, Subtype } from '../types';
import { Check, Field, Modal, useAction } from '../ui';

type CategoryDraft = { emoji: string; label: string; labelMg: string; keywords: string; active: boolean };

const emptyDraft: CategoryDraft = { emoji: '', label: '', labelMg: '', keywords: '', active: true };

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
  const [label, setLabel] = useState(sub.label);
  const [labelMg, setLabelMg] = useState(sub.labelMg);
  const dirty = label !== sub.label || labelMg !== sub.labelMg;

  const save = (patch: Partial<Subtype>) =>
    run(async () => {
      onSaved(await api<Category[]>(`/catalog/subtypes/${sub.id}`, { method: 'PUT', body: patch }));
    });

  return (
    <div className="subtype-row">
      <button className="btn-icon" disabled={first} onClick={() => onMove(-1)} title={t('moveUp')}>
        ↑
      </button>
      <button className="btn-icon" disabled={last} onClick={() => onMove(1)} title={t('moveDown')}>
        ↓
      </button>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('labelFr')} />
      <input value={labelMg} onChange={(e) => setLabelMg(e.target.value)} placeholder={t('labelMg')} />
      {dirty && (
        <button className="btn btn-sm btn-primary" disabled={busy || !label.trim()} onClick={() => save({ label, labelMg })}>
          {t('save')}
        </button>
      )}
      <Check checked={sub.active} onChange={(active) => save({ active })} />
      <button
        className="btn-icon"
        title={t('delete')}
        onClick={() => {
          if (!confirm(t('deleteSubtypeConfirm'))) return;
          run(async () => {
            await api(`/catalog/subtypes/${sub.id}`, { method: 'DELETE' });
            onSaved(await api<Category[]>('/catalog'));
          });
        }}
      >
        🗑
      </button>
    </div>
  );
}

export function Catalog() {
  const { t, lang } = useI18n();
  const { catalog, setCatalog } = useCatalog();
  const { run, busy } = useAction();
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
      <div className="page-head">
        <div>
          <h1>{t('navCatalog')}</h1>
          <p className="hint">{t('catalogHint')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ id: null, draft: emptyDraft })}>
          + {t('newCategory')}
        </button>
      </div>

      {catalog.map((cat, i) => (
        <div key={cat.id} className={`category ${cat.active ? '' : 'off'}`}>
          <div className="category-head">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button className="btn-icon" disabled={i === 0} onClick={() => moveCategory(i, -1)} title={t('moveUp')}>
                ↑
              </button>
              <button
                className="btn-icon"
                disabled={i === catalog.length - 1}
                onClick={() => moveCategory(i, 1)}
                title={t('moveDown')}
              >
                ↓
              </button>
            </div>
            <span className="emoji">{cat.emoji}</span>
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
            <button
              className="btn btn-sm"
              onClick={() =>
                setEditing({
                  id: cat.id,
                  draft: {
                    emoji: cat.emoji,
                    label: cat.label,
                    labelMg: cat.labelMg,
                    keywords: cat.keywords.join(', '),
                    active: cat.active,
                  },
                })
              }
            >
              {t('edit')}
            </button>
            <button className="btn btn-sm" onClick={() => setOpen(open === cat.id ? null : cat.id)}>
              {t('subtypes')} {open === cat.id ? '▴' : '▾'}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (!confirm(t('deleteCategoryConfirm'))) return;
                run(async () => {
                  await api(`/catalog/categories/${cat.id}`, { method: 'DELETE' });
                  setCatalog(catalog.filter((c) => c.id !== cat.id));
                });
              }}
            >
              {t('delete')}
            </button>
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
                <span style={{ width: 72 }} />
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
                  {t('add')}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {editing && (
        <Modal title={editing.id ? t('edit') : t('newCategory')} onClose={() => setEditing(null)}>
          <div className="grid" style={{ gridTemplateColumns: '90px 1fr' }}>
            <Field label={t('emoji')}>
              <input
                value={editing.draft.emoji}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, emoji: e.target.value } })}
                maxLength={8}
              />
            </Field>
            <Field label={t('labelFr')}>
              <input
                value={editing.draft.label}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, label: e.target.value } })}
                autoFocus
              />
            </Field>
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
              {editing.id ? t('save') : t('create')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
