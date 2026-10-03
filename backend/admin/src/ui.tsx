import React, { createContext, useCallback, useContext, useState } from 'react';
import { useI18n, type TKey } from './i18n';

type Toast = { id: number; text: string; kind: 'ok' | 'error' };

const ToastContext = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast-${x.kind}`}>
            {x.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

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

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return <span className={`badge badge-${status}`}>{t(`st_${status}` as TKey)}</span>;
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
