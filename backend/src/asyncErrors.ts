import type { NextFunction, Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Route = require('express/lib/router/route');

/**
 * Express 4 ne capture pas les promesses rejetées des handlers async : une
 * seule requête en erreur faisait tomber tout le serveur. On enveloppe chaque
 * handler de route pour transmettre l'erreur au middleware d'erreur.
 * À importer avant la déclaration des routes.
 */
type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

function wrap(fn: unknown): unknown {
  if (typeof fn !== 'function' || fn.length >= 4) return fn;
  const handler = fn as Handler;
  return function wrapped(req: Request, res: Response, next: NextFunction) {
    try {
      const out = handler(req, res, next);
      if (out && typeof (out as Promise<unknown>).catch === 'function') {
        (out as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

for (const method of ['get', 'post', 'put', 'patch', 'delete', 'all']) {
  const original = Route.prototype[method];
  Route.prototype[method] = function patched(...handlers: unknown[]) {
    return original.apply(this, handlers.flat(Infinity).map(wrap));
  };
}
