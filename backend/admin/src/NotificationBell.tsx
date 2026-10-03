import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mdiAccountClockOutline,
  mdiBellOutline,
  mdiBellRingOutline,
  mdiCheckAll,
  mdiCrownOutline,
  mdiStarOutline,
  mdiStorePlusOutline,
} from '@mdi/js';
import { api } from './api';
import { useI18n, type TKey } from './i18n';
import { MdiIcon } from './CategoryIcon';
import { timeAgo, useToast } from './ui';

type Kind = 'registration' | 'plan_request' | 'account' | 'review';
type Item = { kind: Kind; id: string; title: string; detail: string | null; at: string };

const KIND_ICON: Record<Kind, string> = {
  registration: mdiStorePlusOutline,
  plan_request: mdiCrownOutline,
  account: mdiAccountClockOutline,
  review: mdiStarOutline,
};

const KIND_LINK: Record<Kind, string> = {
  registration: '#/garages?status=pending',
  plan_request: '#/garages?plan=request',
  account: '#/garages?tab=accounts',
  review: '#/moderation',
};

const SEEN_KEY = 'mekano-admin-notif-seen';
const POLL_MS = 45_000;

export function NotificationBell({ onChange }: { onChange: () => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN_KEY) ?? '1970-01-01T00:00:00Z');
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'denied' : Notification.permission
  );
  const known = useRef<Set<string> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<Item[]>('/notifications')
      .then((list) => {
        const keys = new Set(list.map((x) => `${x.kind}:${x.id}`));
        if (known.current) {
          const fresh = list.filter((x) => !known.current!.has(`${x.kind}:${x.id}`));
          for (const x of fresh.slice(0, 3)) {
            const head = t(`notif_${x.kind}` as TKey);
            toast(`${x.title}${x.detail ? ` — ${x.detail}` : ''}`, 'info', head);
            if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(`Mekano · ${head}`, { body: x.title, tag: `${x.kind}:${x.id}` });
            }
          }
          if (fresh.length) onChange();
        }
        known.current = keys;
        setItems(list);
      })
      .catch(() => {});
  }, [t, toast, onChange]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unread = items.filter((x) => x.at > seen).length;

  const markAllRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem(SEEN_KEY, now);
    setSeen(now);
  };

  return (
    <div className="notif" ref={box}>
      <button
        className={`topbar-btn ${unread ? 'ringing' : ''}`}
        aria-label={t('notifications')}
        data-tip={open ? undefined : t('notifications')}
        onClick={() => setOpen((o) => !o)}
      >
        <MdiIcon path={unread ? mdiBellRingOutline : mdiBellOutline} size={22} />
        {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <strong>{t('notifications')}</strong>
            {unread > 0 && (
              <button className="link-btn" onClick={markAllRead}>
                <MdiIcon path={mdiCheckAll} size={16} /> {t('markAllRead')}
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 && (
              <div className="notif-empty">
                <MdiIcon path={mdiBellOutline} size={28} />
                {t('notifEmpty')}
              </div>
            )}
            {items.map((x) => (
              <a
                key={`${x.kind}:${x.id}`}
                href={KIND_LINK[x.kind]}
                className={`notif-item ${x.at > seen ? 'unread' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className={`notif-icon kind-${x.kind}`}>
                  <MdiIcon path={KIND_ICON[x.kind]} size={18} />
                </span>
                <span className="notif-body">
                  <span className="notif-kind">{t(`notif_${x.kind}` as TKey)}</span>
                  <strong>{x.title}</strong>
                  {x.detail && <span className="sub">{x.detail}</span>}
                </span>
                <span className="notif-time">{timeAgo(x.at, lang)}</span>
              </a>
            ))}
          </div>
          {permission === 'default' && (
            <button
              className="notif-foot"
              onClick={() => Notification.requestPermission().then(setPermission)}
            >
              <MdiIcon path={mdiBellRingOutline} size={16} /> {t('enableDesktopNotif')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
