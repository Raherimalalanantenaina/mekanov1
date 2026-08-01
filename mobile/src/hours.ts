import type { DayHours, Garage } from './types';

/**
 * Horaires par jour (lundi = index 0).
 * Le badge « Ouvert » combine l'interrupteur manuel du garage (isOpen)
 * et, si renseignés, les horaires structurés du jour courant.
 */

export function defaultWeek(): DayHours[] {
  return Array.from({ length: 7 }, (_, i) => ({
    open: '08:00',
    close: '18:00',
    closed: i === 6, // dimanche fermé par défaut
  }));
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Index du jour courant, lundi = 0 … dimanche = 6. */
export function todayIndex(date = new Date()): number {
  return (date.getDay() + 6) % 7;
}

/** Le planning dit-il « ouvert » en ce moment ? (true si pas de planning) */
export function scheduleSaysOpen(
  hours: DayHours[] | null | undefined,
  date = new Date()
): boolean {
  if (!hours || hours.length !== 7) return true;
  const day = hours[todayIndex(date)];
  if (!day || day.closed) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  return now >= toMinutes(day.open) && now < toMinutes(day.close);
}

/** Statut effectif : interrupteur manuel ET planning du jour. */
export function isOpenNow(
  garage: Pick<Garage, 'isOpen' | 'hoursJson'>,
  date = new Date()
): boolean {
  return garage.isOpen && scheduleSaysOpen(garage.hoursJson, date);
}

/**
 * Résumé texte compact du planning, en groupant les jours consécutifs
 * ayant les mêmes horaires. Ex : « Lun–Ven 08:00–18:00 · Sam 08:00–12:00 ».
 */
export function summarizeWeek(hours: DayHours[], dayNames: string[]): string {
  const label = (d: DayHours) =>
    d.closed ? 'closed' : `${d.open}–${d.close}`;
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i <= 7; i++) {
    if (i === 7 || label(hours[i]) !== label(hours[start])) {
      if (!hours[start].closed) {
        const days =
          i - 1 === start
            ? dayNames[start]
            : `${dayNames[start]}–${dayNames[i - 1]}`;
        parts.push(`${days} ${hours[start].open}–${hours[start].close}`);
      }
      start = i;
    }
  }
  return parts.join(' · ');
}
