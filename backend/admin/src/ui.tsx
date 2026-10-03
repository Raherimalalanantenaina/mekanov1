import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useI18n, type TKey } from './i18n';
import {
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiCheckCircleOutline,
  mdiClose,
  mdiInboxOutline,
  mdiInformationOutline,
} from '@mdi/js';
import { MdiIcon } from './CategoryIcon';

// ─── Toasts ─────────────────────────────────────────────────────────────────

type ToastKind = 'ok' | 'error' | 'info' | 'warning';
type Toast = { id: number; text: string; title?: string; kind: ToastKind };
type ToastFn = (text: string, kind?: ToastKind, title?: string) => void;

const TOAST_ICONS: Record<ToastKind, string> = {
  ok: mdiCheckCircleOutline,
  error: mdiAlertCircleOutline,
  info: mdiInformationOutline,
  warning: mdiAlertOutline,
};

const TOAST_TITLES: Record<ToastKind, TKey> = {
  ok: 'toastOk',
  error: 'toastError',
  info: 'toastInfo',
  warning: 'toastWarning',
};

const ToastContext = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const push = useCallback<ToastFn>(
    (text, kind = 'ok', title) => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list.slice(-3), { id, text, kind, title }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 4000);
    },
    [dismiss]
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast-${x.kind}`}>
            <span className="toast-icon">
              <MdiIcon path={TOAST_ICONS[x.kind]} size={22} />
            </span>
            <div className="toast-text">
              <strong>{x.title ?? t(TOAST_TITLES[x.kind])}</strong>
              <span>{x.text}</span>
            </div>
            <button className="toast-close" onClick={() => dismiss(x.id)} aria-label={t('close')}>
              <MdiIcon path={mdiClose} size={16} />
            </button>
            <i className="toast-progress" style={{ animationDuration: x.kind === 'error' ? '6s' : '4s' }} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ─── Boîtes de confirmation ─────────────────────────────────────────────────

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  icon?: string;
  /** Case à cocher optionnelle (ex. « supprimer aussi le compte »). */
  checkbox?: { label: string; defaultChecked?: boolean };
  /** Champ de saisie optionnel (ex. nouveau mot de passe). */
  input?: { label: string; minLength?: number; placeholder?: string };
};
export type ConfirmResult = { checked: boolean; value: string } | null;

type Pending = ConfirmOptions & { resolve: (r: ConfirmResult) => void };

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<ConfirmResult>>(async () => null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<Pending | null>(null);
  const [checked, setChecked] = useState(false);
  const [value, setValue] = useState('');
  const pendingRef = useRef<Pending | null>(null);

  const ask = useCallback(
    (o: ConfirmOptions) =>
      new Promise<ConfirmResult>((resolve) => {
        const p = { ...o, resolve };
        pendingRef.current = p;
        setChecked(Boolean(o.checkbox?.defaultChecked));
        setValue('');
        setPending(p);
      }),
    []
  );

  const close = (result: ConfirmResult) => {
    pendingRef.current?.resolve(result);
    pendingRef.current = null;
    setPending(null);
  };

  const valid = !pending?.input || value.trim().length >= (pending.input.minLength ?? 1);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <div className="modal-backdrop center" onMouseDown={(e) => e.target === e.currentTarget && close(null)}>
          <form
            className="dialog"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) close({ checked, value: value.trim() });
            }}
          >
            <span className={`dialog-icon ${pending.danger ? 'danger' : ''}`}>
              <MdiIcon path={pending.icon ?? (pending.danger ? mdiAlertOutline : mdiInformationOutline)} size={26} />
            </span>
            <h2>{pending.title}</h2>
            {pending.message && <p>{pending.message}</p>}
            {pending.input && (
              <Field label={pending.input.label}>
                <input
                  autoFocus
                  value={value}
                  placeholder={pending.input.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                />
              </Field>
            )}
            {pending.checkbox && (
              <Check checked={checked} onChange={setChecked} label={pending.checkbox.label} />
            )}
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => close(null)}>
                {t('cancel')}
              </button>
              <button
                type="submit"
                autoFocus={!pending.input}
                disabled={!valid}
                className={`btn ${pending.danger ? 'btn-danger-solid' : 'btn-primary'}`}
              >
                {pending.confirmLabel ?? t('confirm')}
              </button>
            </div>
          </form>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

/** Confirmation de suppression standard. */
export function useConfirmDelete() {
  const confirm = useConfirm();
  const { t } = useI18n();
  return useCallback(
    async (message?: string) =>
      Boolean(
        await confirm({
          title: t('deleteTitle'),
          message: message ?? t('confirmDelete'),
          confirmLabel: t('delete'),
          danger: true,
        })
      ),
    [confirm, t]
  );
}

// ─── Actions async ──────────────────────────────────────────────────────────

/** Exécute une action async : état « busy », toast de succès ou d'erreur. */
export function useAction() {
  const toast = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success: TKey | null = 'saved'): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await fn();
        if (success) toast(t(success));
        return result;
      } catch (err) {
        toast((err as Error).message, 'error');
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast, t]
  );
  return { busy, run };
}

// ─── Composants ─────────────────────────────────────────────────────────────

export function Modal({
  title,
  onClose,
  children,
  wide,
  icon,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  icon?: string;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-head">
          {icon && (
            <span className="modal-head-icon">
              <MdiIcon path={icon} size={20} />
            </span>
          )}
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="close">
            <MdiIcon path={mdiClose} size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

type Tone = 'default' | 'primary' | 'success' | 'danger' | 'warning';

/** Bouton icône avec infobulle (actions CRUD). */
export function IconButton({
  icon,
  label,
  onClick,
  tone = 'default',
  disabled,
  size = 18,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  tone?: Tone;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      className={`icon-btn tone-${tone}`}
      data-tip={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <MdiIcon path={icon} size={size} />
    </button>
  );
}

export function PageHead({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-title">
        {icon && (
          <span className="page-icon">
            <MdiIcon path={icon} size={22} />
          </span>
        )}
        <div>
          <h1>{title}</h1>
          {hint && <p className="hint">{hint}</p>}
        </div>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function EmptyState({ text, icon = mdiInboxOutline }: { text: string; icon?: string }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <MdiIcon path={icon} size={30} />
      </span>
      {text}
    </div>
  );
}

export function Loader({ text }: { text?: string }) {
  return (
    <div className="empty">
      <span className="spinner" />
      {text}
    </div>
  );
}

const AVATAR_COLORS = ['#12717a', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5'];

export function Avatar({ name, src, size = 38 }: { name: string; src?: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const bg = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: src ? undefined : bg, fontSize: size * 0.38 }}>
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <span className={`badge badge-${status}`}>
      <i />
      {t(`st_${status}` as TKey)}
    </span>
  );
}

export function Check({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`check ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch" />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function formatDate(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang === 'mg' ? 'fr-MG' : 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDay(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'mg' ? 'fr-MG' : 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** « il y a 5 min », « il y a 2 j »… */
export function timeAgo(iso: string, lang: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const mg = lang === 'mg';
  if (s < 60) return mg ? 'izao' : "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return mg ? `${m} min lasa` : `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return mg ? `${h} ora lasa` : `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return mg ? `${d} andro lasa` : `il y a ${d} j`;
}

/** Ajoute des mois à une date (ou à aujourd'hui si elle est passée). Renvoie AAAA-MM-JJ. */
export function addMonths(fromIso: string | null, months: number): string {
  const now = new Date();
  const from = fromIso && new Date(fromIso) > now ? new Date(fromIso) : now;
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function PlanBadge({ plan, name }: { plan: string; name?: string }) {
  return <span className={`plan-badge plan-${plan}`}>{name || plan}</span>;
}
