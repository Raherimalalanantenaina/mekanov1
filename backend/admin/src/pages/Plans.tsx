import { useI18n, type TKey } from '../i18n';
import { PLAN_FEATURES, PLAN_IDS, type Plan, type PlanId } from '../types';
import { Check, Field } from '../ui';
import { useAppConfig } from '../useAppConfig';

export function Plans() {
  const { t } = useI18n();
  const { config, setConfig, save, busy } = useAppConfig();

  if (!config) return <div className="empty">{t('loading')}</div>;
  const setPlan = (id: PlanId, patch: Partial<Plan>) =>
    setConfig({ ...config, plans: { ...config.plans, [id]: { ...config.plans[id], ...patch } } });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('navPlans')}</h1>
          <p className="hint">{t('plansHint')}</p>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={() => save(config)}>
          {t('save')}
        </button>
      </div>

      <div className="grid grid-2">
        {PLAN_IDS.map((id) => {
          const plan = config.plans[id];
          return (
            <div key={id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <span className={`plan-badge plan-${id}`}>{plan.name.fr || id}</span>
                <strong>
                  {plan.price > 0 ? `${plan.price.toLocaleString('fr-FR')} ${t('perMonth')}` : t('free')}
                </strong>
              </div>
              <div className="grid grid-2">
                <Field label={`${t('planName')} (FR)`}>
                  <input
                    value={plan.name.fr}
                    onChange={(e) => setPlan(id, { name: { ...plan.name, fr: e.target.value } })}
                  />
                </Field>
                <Field label={`${t('planName')} (MG)`}>
                  <input
                    value={plan.name.mg}
                    onChange={(e) => setPlan(id, { name: { ...plan.name, mg: e.target.value } })}
                  />
                </Field>
                <Field label={t('planPrice')}>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={plan.price}
                    onChange={(e) => setPlan(id, { price: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </Field>
                <Field label={t('maxServices')} hint={t('maxServicesHint')}>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={plan.maxServices}
                    onChange={(e) =>
                      setPlan(id, { maxServices: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })
                    }
                  />
                </Field>
              </div>
              <div className="plan-features">
                {PLAN_FEATURES.map((f) => (
                  <Check
                    key={f}
                    checked={plan.features[f]}
                    label={t(`pf_${f}` as TKey)}
                    onChange={(v) => setPlan(id, { features: { ...plan.features, [f]: v } })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
