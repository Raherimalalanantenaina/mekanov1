import { useI18n, type TKey } from '../i18n';
import { FORM_FIELDS } from '../types';
import { Check, Field, Loader, PageHead } from '../ui';
import { mdiContentSave, mdiFormSelect } from '@mdi/js';
import { MdiIcon } from '../CategoryIcon';
import { useAppConfig } from '../useAppConfig';

export function GarageForm() {
  const { t } = useI18n();
  const { config, setConfig, save, busy } = useAppConfig();

  if (!config) return <Loader />;
  const form = config.garageForm;
  const setForm = (patch: Partial<typeof form>) => setConfig({ ...config, garageForm: { ...form, ...patch } });

  return (
    <>
      <PageHead title={t('navGarageForm')} hint={t('formHint')} icon={mdiFormSelect}>
        <button className="btn btn-primary" disabled={busy} onClick={() => save(config)}>
          <MdiIcon path={mdiContentSave} size={17} /> {t('save')}
        </button>
      </PageHead>

      <div className="card">
        <div className="grid grid-2">
          <Field label={t('maxPhotos')} hint="1 – 30">
            <input
              type="number"
              min={1}
              max={30}
              value={form.maxPhotos}
              onChange={(e) => setForm({ maxPhotos: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
            />
          </Field>
          <div style={{ paddingTop: 24 }}>
            <Check
              checked={form.minCategories > 0}
              label={t('minCategories')}
              onChange={(v) => setForm({ minCategories: v ? 1 : 0 })}
            />
          </div>
        </div>
      </div>

      <div className="card card-flush">
        <table>
          <thead>
            <tr>
              <th>{t('field')}</th>
              <th>{t('visible')}</th>
              <th>{t('required')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {t('name')}, {t('address')}, {t('types')}
              </td>
              <td>
                <Check checked disabled onChange={() => {}} />
              </td>
              <td>
                <Check checked disabled onChange={() => {}} />
              </td>
            </tr>
            {FORM_FIELDS.map((f) => {
              const rule = form.fields[f];
              const setRule = (patch: Partial<typeof rule>) => {
                const next = { ...rule, ...patch };
                if (!next.visible) next.required = false;
                setForm({ fields: { ...form.fields, [f]: next } });
              };
              return (
                <tr key={f}>
                  <td>{t(`ff_${f}` as TKey)}</td>
                  <td>
                    <Check checked={rule.visible} onChange={(visible) => setRule({ visible })} />
                  </td>
                  <td>
                    <Check checked={rule.required} disabled={!rule.visible} onChange={(required) => setRule({ required })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
