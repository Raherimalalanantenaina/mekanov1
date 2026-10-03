import type { Server } from 'http';
import type { RequestHandler } from 'express';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Temps réel : les apps restent connectées en WebSocket sur /api/ws.
 * Le serveur n'envoie aucune donnée, juste un signal « sync » après chaque
 * modification ; l'app interroge alors /api/sync (empreintes filtrées selon
 * son compte) et ne recharge que ce qui a changé.
 */

let wss: WebSocketServer | null = null;
let pending: ReturnType<typeof setTimeout> | null = null;

const alive = new WeakMap<WebSocket, boolean>();

export function attachRealtime(server: Server) {
  wss = new WebSocketServer({ server, path: '/api/ws' });
  wss.on('connection', (ws) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('error', () => ws.terminate());
    ws.send(JSON.stringify({ type: 'hello' }));
  });
  // Ping régulier : garde la connexion ouverte derrière les proxys et
  // nettoie les téléphones partis sans fermer la connexion.
  const heartbeat = setInterval(() => {
    for (const ws of wss?.clients ?? []) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, 25_000);
  wss.on('close', () => clearInterval(heartbeat));
}

/** Signale aux apps connectées qu'il y a du nouveau (regroupé sur 400 ms). */
export function notifyChange() {
  if (!wss || pending) return;
  pending = setTimeout(() => {
    pending = null;
    const msg = JSON.stringify({ type: 'sync', at: Date.now() });
    for (const ws of wss?.clients ?? []) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }, 400);
}

// Requêtes d'écriture qui ne changent rien de visible pour les autres
const SILENT = [/^\/api\/push\b/, /^\/api\/auth\b/, /\/track\/[^/]+$/, /^\/api\/superadmin\/login\b/];

/** Après toute écriture réussie sur l'API, prévient les apps connectées. */
export const realtimeMiddleware: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const url = req.originalUrl.split('?')[0];
  if (SILENT.some((r) => r.test(url))) return next();
  res.on('finish', () => {
    if (res.statusCode < 400) notifyChange();
  });
  next();
};
