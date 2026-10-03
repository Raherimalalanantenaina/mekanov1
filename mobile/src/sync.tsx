import React from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from './config';
import { getClientId, getToken } from './api/client';

/**
 * Synchronisation avec le back-office. L'app garde une connexion WebSocket
 * (/api/ws) : à chaque modification, le serveur envoie un signal et l'app
 * compare aussitôt les empreintes de /api/sync. Si la connexion tombe, elle
 * revient à une vérification toutes les 15 s. Seuls les sujets modifiés sont
 * signalés aux écrans abonnés, qui se rechargent sans spinner.
 */

export type SyncTopic = 'config' | 'garages' | 'client' | 'account' | 'inbox';

const POLL_MS = 15_000;
/** Filet de sécurité quand le temps réel est connecté */
const POLL_LIVE_MS = 90_000;
const listeners = new Set<(topics: SyncTopic[]) => void>();
let last: Partial<Record<SyncTopic, string>> = {};
let running = false;
let again = false;

function emit(topics: SyncTopic[]) {
  for (const l of listeners) l(topics);
}

/** Vérifie immédiatement s'il y a du nouveau côté serveur. */
export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    const [token, clientId] = await Promise.all([getToken(), getClientId()]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API_BASE_URL}/api/sync?clientId=${encodeURIComponent(clientId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return;
    const next = (await res.json()) as Partial<Record<SyncTopic, string>>;
    const changed = (Object.keys(next) as SyncTopic[]).filter(
      // Première réponse pour un sujet = point de référence, pas un changement
      (k) => last[k] !== undefined && last[k] !== next[k]
    );
    last = { ...last, ...next };
    if (changed.length) emit(changed);
  } catch {
    /* hors ligne : on réessaiera au prochain tour */
  } finally {
    running = false;
    if (again) {
      again = false;
      syncNow();
    }
  }
}

/** Oublie les empreintes du compte (connexion / déconnexion). */
export function resetAccountSync() {
  delete last.account;
  delete last.inbox;
}

/** Appelle `onChange` quand l'un des sujets change côté serveur. */
export function useSync(topics: SyncTopic[], onChange: () => void) {
  const ref = React.useRef(onChange);
  ref.current = onChange;
  const key = topics.join(',');
  React.useEffect(() => {
    const wanted = key.split(',') as SyncTopic[];
    const l = (changed: SyncTopic[]) => {
      if (changed.some((c) => wanted.includes(c))) ref.current();
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [key]);
}

/** Lance la boucle de synchronisation (à monter une seule fois). */
export function SyncRunner() {
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let backoff = 2000;
    let active = false;

    const schedule = (ms: number) => {
      if (timer) clearInterval(timer);
      timer = setInterval(syncNow, ms);
    };

    const connect = () => {
      if (!active || ws) return;
      const url = `${API_BASE_URL.replace(/^http/, 'ws')}/api/ws`;
      const socket = new WebSocket(url);
      ws = socket;
      socket.onopen = () => {
        backoff = 2000;
        schedule(POLL_LIVE_MS);
        // Rattrape ce qui a pu changer pendant la déconnexion
        syncNow();
      };
      socket.onmessage = (e) => {
        try {
          if (JSON.parse(String(e.data)).type === 'sync') syncNow();
        } catch {
          /* message inconnu */
        }
      };
      socket.onclose = () => {
        if (ws === socket) ws = null;
        if (!active) return;
        schedule(POLL_MS);
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 60_000);
      };
      socket.onerror = () => socket.close();
    };

    const start = () => {
      if (active) return;
      active = true;
      syncNow();
      schedule(POLL_MS);
      connect();
    };
    const stop = () => {
      active = false;
      if (timer) clearInterval(timer);
      timer = null;
      if (retry) clearTimeout(retry);
      retry = null;
      ws?.close();
      ws = null;
    };
    if (AppState.currentState === 'active') start();
    const appSub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    const pushSub = Notifications.addNotificationReceivedListener(() => syncNow());
    const tapSub = Notifications.addNotificationResponseReceivedListener(() => syncNow());
    return () => {
      stop();
      appSub.remove();
      pushSub.remove();
      tapSub.remove();
    };
  }, []);
  return null;
}
