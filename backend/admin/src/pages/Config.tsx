import { api, readFileAsDataUrl } from '../api';
import { useCatalog } from '../App';
import { useI18n, type TKey } from '../i18n';
import { FEATURES, type AppConfig, type LocalizedText } from '../types';
import { Check, Field, Loader, PageHead } from '../ui';
import { useAppConfig } from '../useAppConfig';
import { mdiCogOutline, mdiContentSave, mdiMagnify } from '@mdi/js';
import { CategoryIcon, MdiIcon } from '../CategoryIcon';

type TextKey = keyof AppConfig['texts'];
const TEXT_KEYS: TextKey[] = ['heroTitle1', 'heroTitle2', 'searchPlaceholder'];

const DEFAULT_TEXTS: Record<TextKey, LocalizedText> = {
  heroTitle1: { fr: 'Trouve le bon garage,', mg: 'Tadiavo ny garazy mety,' },
  heroTitle2: { fr: 'où que tu sois.', mg: 'na aiza na aiza.' },
  searchPlaceholder: { fr: 'Nom, ville, service…', mg: 'Anarana, tanàna, tolotra…' },
};

export function Config() {
  const { t, lang } = useI18n();
  const { catalog } = useCatalog();
  const { config, setConfig, logoUrl, setLogoUrl, save, busy, run } = useAppConfig();

  if (!config) return <Loader />;

  const update = (patch: Partial<AppConfig>) => setConfig({ ...config, ...patch });
  const setText = (key: TextKey, l: 'fr' | 'mg', value: string) =>
    update({ texts: { ...config.texts, [key]: { ...config.texts[key], [l]: value } } });

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    run(async () => {
      const res = await api<{ logoUrl: string }>('/config/logo', { method: 'PUT', body: { dataUrl } });
      setLogoUrl(res.logoUrl);
    });
  };

  const text = (key: TextKey) => config.texts[key][lang] || DEFAULT_TEXTS[key][lang];
  const { primary, accent } = config.colors;

  return (
    <>
      <PageHead title={t('navConfig')} icon={mdiCogOutline}>
        <button className="btn btn-primary" disabled={busy} onClick={() => save(config)}>
          <MdiIcon path={mdiContentSave} size={17} /> {t('save')}
        </button>
      </PageHead>

      <div className="config-layout">
        <div>
          <div className="card">
            <h3>{t('identity')}</h3>
            <div className="grid grid-2">
              <Field label={t('appName')}>
                <input value={config.appName} maxLength={40} onChange={(e) => update({ appName: e.target.value })} />
              </Field>
              <Field label={t('logo')} hint={t('logoHint')}>
                <div className="row">
                  {logoUrl && <img src={logoUrl} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />}
                  <label className="btn btn-sm">
                    {t('uploadLogo')}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      hidden
                      onChange={(e) => uploadLogo(e.target.files?.[0])}
                    />
                  </label>
                  {logoUrl && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() =>
                        run(async () => {
                          await api('/config/logo', { method: 'DELETE' });
                          setLogoUrl(null);
                        })
                      }
                    >
                      {t('removeLogo')}
                    </button>
                  )}
                </div>
              </Field>
            </div>
          </div>

          <div className="card">
            <h3>{t('colors')}</h3>
            <div className="row" style={{ gap: 30 }}>
              {(['primary', 'accent'] as const).map((k) => (
                <Field key={k} label={t(k)}>
                  <div className="row">
                    <input
                      type="color"
                      value={config.colors[k]}
                      onChange={(e) => update({ colors: { ...config.colors, [k]: e.target.value } })}
                    />
                    <input
                      value={config.colors[k]}
                      style={{ width: 110 }}
                      onChange={(e) => update({ colors: { ...config.colors, [k]: e.target.value } })}
                    />
                  </div>
                </Field>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>{t('texts')}</h3>
            <p className="hint">{t('textsHint')}</p>
            {TEXT_KEYS.map((key) => (
              <div key={key} className="grid grid-2" style={{ marginBottom: 10 }}>
                <Field label={`${t(key)} — FR`}>
                  <input
                    value={config.texts[key].fr}
                    placeholder={DEFAULT_TEXTS[key].fr}
                    onChange={(e) => setText(key, 'fr', e.target.value)}
                  />
                </Field>
                <Field label={`${t(key)} — MG`}>
                  <input
                    value={config.texts[key].mg}
                    placeholder={DEFAULT_TEXTS[key].mg}
                    onChange={(e) => setText(key, 'mg', e.target.value)}
                  />
                </Field>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>{t('features')}</h3>
            <div className="grid grid-2">
              {FEATURES.map((f) => (
                <Check
                  key={f}
                  checked={config.features[f]}
                  label={t(`f_${f}` as TKey)}
                  onChange={(v) => update({ features: { ...config.features, [f]: v } })}
                />
              ))}
            </div>
          </div>

          <div className="card">
            <h3>{t('approval')}</h3>
            <p className="hint">{t('approvalHint')}</p>
            <div className="grid">
              <Check
                checked={config.approval.accounts}
                label={t('approvalAccounts')}
                onChange={(v) => update({ approval: { ...config.approval, accounts: v } })}
              />
              <Check
                checked={config.approval.garages}
                label={t('approvalGarages')}
                onChange={(v) => update({ approval: { ...config.approval, garages: v } })}
              />
            </div>
          </div>

          <div className="card">
            <h3>{t('support')}</h3>
            <div className="grid grid-2">
              <Field label={t('supportPhone')}>
                <input
                  value={config.support.phone}
                  onChange={(e) => update({ support: { ...config.support, phone: e.target.value } })}
                />
              </Field>
              <Field label={t('supportEmail')}>
                <input
                  type="email"
                  value={config.support.email}
                  onChange={(e) => update({ support: { ...config.support, email: e.target.value } })}
                />
              </Field>
            </div>
          </div>
        </div>

        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>
            {t('preview')}
          </div>
          <div className="phone">
            <div className="phone-hero" style={{ background: `linear-gradient(160deg, ${primary}, ${primary}cc)` }}>
              <div className="phone-brand">
                <img src={logoUrl ?? '/api/config/logo'} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                {config.appName.toUpperCase()}
              </div>
              <div className="phone-title">
                {text('heroTitle1')} <span style={{ color: accent }}>{text('heroTitle2')}</span>
              </div>
              <div className="phone-search cat-inline">
                <MdiIcon path={mdiMagnify} size={13} /> {text('searchPlaceholder')}
              </div>
            </div>
            <div className="phone-chips">
              {catalog
                .filter((c) => c.active)
                .slice(0, 8)
                .map((c, i) => (
                  <span
                    key={c.id}
                    className="phone-chip cat-inline"
                    style={i === 0 ? { background: primary, color: '#fff', borderColor: primary } : undefined}
                  >
                    <CategoryIcon name={c.icon} size={12} />
                    {(lang === 'mg' && c.labelMg) || c.label}
                  </span>
                ))}
            </div>
            {config.features.sos && (
              <div className="phone-sos" style={{ background: accent }}>
                🆘 SOS
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
