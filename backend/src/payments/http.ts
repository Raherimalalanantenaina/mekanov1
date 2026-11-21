import { ProviderError } from './types';

/** Appel HTTP vers un opérateur, avec délai max et message d'erreur lisible. */
export async function callJson<T = any>(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number }
): Promise<{ status: number; body: T }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: init.headers,
      body: init.body,
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new ProviderError(
      ctrl.signal.aborted ? 'Opérateur injoignable (délai dépassé)' : 'Opérateur injoignable',
      String(err)
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* réponse non JSON */
  }
  return { status: res.status, body: body as T };
}

/** Cache d'un jeton OAuth2 jusqu'à peu avant son expiration. */
export function tokenCache(fetchToken: () => Promise<{ token: string; expiresIn: number }>) {
  let cached: { token: string; until: number } | null = null;
  let inflight: Promise<string> | null = null;
  return async (): Promise<string> => {
    if (cached && cached.until > Date.now()) return cached.token;
    if (!inflight) {
      inflight = fetchToken()
        .then(({ token, expiresIn }) => {
          cached = { token, until: Date.now() + Math.max(30, expiresIn - 60) * 1000 };
          return token;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  };
}

export const basic = (user: string, pass: string) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
