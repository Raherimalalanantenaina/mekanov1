import { query } from './db/pool';
import { getConfig } from './appSettings';
import { pushToUser } from './push';
import { notifyChange } from './realtime';

/** Rappel envoyé au garagiste quand son offre arrive à échéance dans moins de… */
const REMIND_DAYS = 3;
const EVERY_MS = 60 * 60 * 1000;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

async function planName(id: string): Promise<string> {
  const { plans } = (await getConfig()).config;
  return plans[id as keyof typeof plans]?.name.fr ?? id;
}

/**
 * Échéance des offres payantes :
 *  - rappel push au garagiste quelques jours avant la fin ;
 *  - à la date de fin, retour en gratuit (avec trace pour le back-office) et push.
 */
export async function runPlanJobs() {
  const reminders = await query<{
    id: string;
    name: string;
    owner_id: string;
    plan: string;
    plan_expires_at: string;
  }>(
    `UPDATE garages SET plan_reminded_for = plan_expires_at
      WHERE plan <> 'free'
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at > NOW()
        AND plan_expires_at < NOW() + ($1 || ' days')::interval
        AND plan_reminded_for IS DISTINCT FROM plan_expires_at
      RETURNING id, name, owner_id, plan, plan_expires_at`,
    [String(REMIND_DAYS)]
  );
  for (const g of reminders.rows) {
    const name = await planName(g.plan);
    pushToUser(g.owner_id, {
      title: `Offre ${name} bientôt terminée`,
      body: `${g.name} : ton offre ${name} se termine le ${fmtDate(g.plan_expires_at)}. Pense à la renouveler dans « Mon garage ».`,
      data: { type: 'plan' },
    }).catch(() => {});
  }

  const expired = await query<{ id: string; name: string; owner_id: string; plan_expired_from: string }>(
    `UPDATE garages
        SET plan_expired_from = plan,
            plan_expired_at = NOW(),
            plan = 'free',
            plan_expires_at = NULL,
            plan_reminded_for = NULL,
            updated_at = NOW()
      WHERE plan <> 'free'
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at <= NOW()
      RETURNING id, name, owner_id, plan_expired_from`
  );
  for (const g of expired.rows) {
    const name = await planName(g.plan_expired_from);
    pushToUser(g.owner_id, {
      title: `Offre ${name} expirée`,
      body: `${g.name} est repassé à l’offre gratuite. Tu peux la renouveler dans « Mon garage ».`,
      data: { type: 'plan' },
    }).catch(() => {});
  }
  if (expired.rows.length > 0) notifyChange();
  return { reminded: reminders.rows.length, expired: expired.rows.length };
}

export function startPlanJobs() {
  const tick = () =>
    runPlanJobs().catch((err) => console.warn('Échéance des offres :', err));
  setTimeout(tick, 10_000);
  setInterval(tick, EVERY_MS);
}
