import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../config';
import type {
  Appointment,
  AuthUser,
  DailyStat,
  Garage,
  GaragesResponse,
  Quote,
  QuoteMessage,
  Review,
} from '../types';

const CACHE_KEY = 'mekano:garages:v1';
const TOKEN_KEY = 'mekano:token';
const USER_KEY = 'mekano:user';
const CLIENT_ID_KEY = 'mekano:clientId';
const FAVORITES_KEY = 'mekano:favorites';

/** Identifiant anonyme de l'appareil (clients sans compte). */
export async function getClientId(): Promise<string> {
  let id = await AsyncStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

/** Favoris (stockés localement, disponibles hors ligne). */
export async function getFavorites(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function toggleFavorite(garageId: string): Promise<string[]> {
  const favs = await getFavorites();
  const next = favs.includes(garageId)
    ? favs.filter((id) => id !== garageId)
    : [...favs, garageId];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveSession(token: string, user: AuthUser) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function getCachedUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export async function getCachedGarages(): Promise<GaragesResponse | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  const data = JSON.parse(raw) as GaragesResponse;
  return { ...data, offline: true };
}

async function cacheGarages(payload: GaragesResponse) {
  await AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ ...payload, offline: false })
  );
}

async function api<T>(
  path: string,
  options: RequestInit = {},
  auth = false
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchGarages(params?: {
  q?: string;
  city?: string;
  lat?: number;
  lng?: number;
}): Promise<GaragesResponse> {
  const online = await isOnline();
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.city) query.set('city', params.city);
  if (params?.lat != null) query.set('lat', String(params.lat));
  if (params?.lng != null) query.set('lng', String(params.lng));

  if (!online) {
    const cached = await getCachedGarages();
    if (cached) {
      let list = cached.garages;
      if (params?.q) {
        const q = params.q.toLowerCase();
        list = list.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.city.toLowerCase().includes(q) ||
            g.address.toLowerCase().includes(q)
        );
      }
      if (params?.city) {
        list = list.filter((g) =>
          g.city.toLowerCase().includes(params.city!.toLowerCase())
        );
      }
      return { ...cached, offline: true, garages: list };
    }
    throw new Error('Hors ligne et aucun cache disponible');
  }

  try {
    const data = await api<GaragesResponse>(
      `/api/garages?${query.toString()}`
    );
    await cacheGarages(data);
    return { ...data, offline: false };
  } catch (err) {
    const cached = await getCachedGarages();
    if (cached) return cached;
    throw err;
  }
}

export async function fetchGarageById(id: string): Promise<Garage> {
  const online = await isOnline();
  if (!online) {
    const cached = await getCachedGarages();
    const found = cached?.garages.find((g) => g.id === id);
    if (found) return found;
    throw new Error('Garage indisponible hors ligne');
  }
  try {
    return await api<Garage>(`/api/garages/${id}`);
  } catch (err) {
    const cached = await getCachedGarages();
    const found = cached?.garages.find((g) => g.id === id);
    if (found) return found;
    throw err;
  }
}

export async function login(email: string, password: string) {
  const data = await api<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await saveSession(data.token, data.user);
  return data;
}

export async function register(
  email: string,
  password: string,
  fullName: string
) {
  const data = await api<{ token: string; user: AuthUser }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    }
  );
  await saveSession(data.token, data.user);
  return data;
}

/** Récupère le profil à jour (utile pour voir si le compte a été validé). */
export async function fetchMe(): Promise<AuthUser> {
  const me = await api<AuthUser>('/api/auth/me', {}, true);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(me));
  return me;
}

export async function fetchMyGarages(): Promise<Garage[]> {
  return api<Garage[]>('/api/garages/mine/list', {}, true);
}

export async function createGarage(
  payload: Partial<Garage> & {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  }
): Promise<Garage> {
  return api<Garage>(
    '/api/garages',
    { method: 'POST', body: JSON.stringify(payload) },
    true
  );
}

export async function updateGarage(
  id: string,
  payload: Partial<Garage>
): Promise<Garage> {
  return api<Garage>(
    `/api/garages/${id}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    true
  );
}

export async function deleteGarage(id: string): Promise<void> {
  await api<void>(`/api/garages/${id}`, { method: 'DELETE' }, true);
}

/* ===== Statistiques ===== */

export async function trackGarage(id: string, kind: 'view' | 'call') {
  try {
    await api<void>(`/api/garages/${id}/track/${kind}`, { method: 'POST' });
  } catch {
    /* silencieux */
  }
}

/** Statistiques journalières du garage (propriétaire uniquement). */
export async function fetchGarageDailyStats(
  id: string,
  days = 7
): Promise<DailyStat[]> {
  return api<DailyStat[]>(`/api/garages/${id}/stats/daily?days=${days}`, {}, true);
}

/* ===== Notifications push ===== */

/** Enregistre le jeton push Expo auprès du serveur. */
export async function registerPushToken(token: string): Promise<void> {
  const clientId = await getClientId();
  await api<void>(
    '/api/push/register',
    { method: 'POST', body: JSON.stringify({ token, clientId }) },
    true // associe aussi le compte garage si connecté
  );
}

/* ===== Avis ===== */

export async function fetchReviews(garageId: string): Promise<Review[]> {
  return api<Review[]>(`/api/garages/${garageId}/reviews`);
}

export async function postReview(
  garageId: string,
  payload: { authorName: string; rating: number; comment: string }
) {
  return api(`/api/garages/${garageId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/* ===== Devis ===== */

export async function createQuote(payload: {
  garageId: string;
  clientName: string;
  clientPhone: string;
  description: string;
  photo?: string;
}): Promise<Quote> {
  const clientId = await getClientId();
  return api<Quote>('/api/quotes', {
    method: 'POST',
    body: JSON.stringify({ ...payload, clientId }),
  });
}

export async function fetchMyQuotes(): Promise<Quote[]> {
  const clientId = await getClientId();
  return api<Quote[]>(`/api/quotes/client/${clientId}`);
}

export async function fetchReceivedQuotes(): Promise<Quote[]> {
  return api<Quote[]>('/api/quotes/mine', {}, true);
}

export async function fetchQuoteMessages(
  quoteId: string
): Promise<QuoteMessage[]> {
  return api<QuoteMessage[]>(`/api/quotes/${quoteId}/messages`);
}

export async function sendQuoteMessage(
  quoteId: string,
  sender: 'client' | 'garage',
  body: string,
  photo = ''
): Promise<QuoteMessage> {
  const payload: Record<string, string> = { sender, body, photo };
  if (sender === 'client') payload.clientId = await getClientId();
  return api<QuoteMessage>(
    `/api/quotes/${quoteId}/messages`,
    { method: 'POST', body: JSON.stringify(payload) },
    sender === 'garage'
  );
}

/* ===== Rendez-vous ===== */

export async function createAppointment(payload: {
  garageId: string;
  clientName: string;
  clientPhone: string;
  slot: string;
  note?: string;
}): Promise<Appointment> {
  const clientId = await getClientId();
  return api<Appointment>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify({ ...payload, clientId }),
  });
}

export async function fetchMyAppointments(): Promise<Appointment[]> {
  const clientId = await getClientId();
  return api<Appointment[]>(`/api/appointments/client/${clientId}`);
}

export async function fetchReceivedAppointments(): Promise<Appointment[]> {
  return api<Appointment[]>('/api/appointments/mine', {}, true);
}

export async function setAppointmentStatus(
  id: string,
  status: 'accepted' | 'declined'
): Promise<Appointment> {
  return api<Appointment>(
    `/api/appointments/${id}/status`,
    { method: 'PUT', body: JSON.stringify({ status }) },
    true
  );
}

export async function checkOnline(): Promise<boolean> {
  return isOnline();
}

export type LatLng = { latitude: number; longitude: number };

export type RouteResult = {
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
  straightLine: boolean;
  /** true si l'itinéraire vient du cache local (mode hors ligne) */
  fromCache?: boolean;
};

const ROUTE_CACHE_PREFIX = 'mekano:route:';

/**
 * Itinéraire routier via OSRM (gratuit, sans clé).
 * Chaque itinéraire calculé en ligne est mis en cache par garage : hors
 * ligne, on réaffiche le vrai tracé enregistré au lieu d'une ligne droite.
 * La ligne droite ne sert plus que d'ultime secours (jamais vu en ligne).
 */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  cacheKey?: string
): Promise<RouteResult> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('OSRM indisponible');
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error('Pas de route');
    const result: RouteResult = {
      coords: route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
      ),
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      straightLine: false,
    };
    if (cacheKey) {
      AsyncStorage.setItem(
        `${ROUTE_CACHE_PREFIX}${cacheKey}`,
        JSON.stringify(result)
      ).catch(() => {});
    }
    return result;
  } catch {
    // 1er secours : le vrai itinéraire enregistré lors d'une consultation en ligne
    if (cacheKey) {
      try {
        const raw = await AsyncStorage.getItem(`${ROUTE_CACHE_PREFIX}${cacheKey}`);
        if (raw) {
          const cached = JSON.parse(raw) as RouteResult;
          return { ...cached, fromCache: true };
        }
      } catch {
        /* cache illisible : on continue vers la ligne droite */
      }
    }
    // Dernier secours : ligne droite + distance haversine
    const R = 6371;
    const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
    const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((from.latitude * Math.PI) / 180) *
        Math.cos((to.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distanceKm = 2 * R * Math.asin(Math.sqrt(a));
    return {
      coords: [from, to],
      distanceKm,
      durationMin: (distanceKm / 30) * 60,
      straightLine: true,
    };
  }
}
