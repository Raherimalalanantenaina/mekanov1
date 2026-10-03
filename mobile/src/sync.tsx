import React from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from './config';
import { getClientId, getToken } from './api/client';

/**
 * Synchronisation avec le back-office : l'app interroge /api/sync (empreintes
 * légères) toutes les 15 s quand elle est au premier plan, au retour dans
 * l'app et à chaque notification reçue. Seuls les sujets modifiés sont
 * signalés aux écrans abonnés, qui se rechargent sans spinner.
 */

export type SyncTopic = 'config' | 'garages' | 'client' | 'account' | 'inbox';

const POLL_MS = 15_000;
const listeners = new Set<(topics: SyncTopic[]) => void>();
let last: Partial<Record<SyncTopic, string>> = {};
let running = false;

function emit(topics: SyncTopic[]) {
  for (const l of listeners) l(topics);
}

/** Vérifie immédiatement s'il y a du nouveau côté serveur. */
export async function syncNow(): Promise<void> {
  if (running) return;
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
    const start = () => {
      if (timer) return;
      syncNow();
      timer = setInterval(syncNow, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
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
