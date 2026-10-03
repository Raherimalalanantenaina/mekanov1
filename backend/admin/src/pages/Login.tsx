import { useState } from 'react';
import { mdiAlertCircleOutline, mdiEmailOutline, mdiGarageVariant, mdiLockOutline, mdiLogin, mdiTranslate } from '@mdi/js';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Field } from '../ui';
import { MdiIcon } from '../CategoryIcon';

export function Login({ onLogin }: { onLogin: (token: string, email: string) => void }) {
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ token: string; email: string }>('/login', {
        method: 'POST',
        body: { email, password },
      });
      onLogin(res.token, res.email);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <aside className="login-side">
        <div className="login-logo">
          <span>
            <MdiIcon path={mdiGarageVariant} size={22} />
          </span>
          Mekano
        </div>
        <div>
          <h2>{t('appTitle')}</h2>
          <p>{t('loginSubtitle')}</p>
        </div>
        <span style={{ fontSize: 12, opacity: 0.6 }}>© Mekano</span>
      </aside>
      <div className="login-main">
        <form className="login-card" onSubmit={submit}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <h1>{t('login')}</h1>
              <p className="hint">{t('loginSubtitle')}</p>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setLang(lang === 'fr' ? 'mg' : 'fr')}>
              <MdiIcon path={mdiTranslate} size={15} /> {lang === 'fr' ? 'MG' : 'FR'}
            </button>
          </div>
          {error && (
            <div className="error">
              <MdiIcon path={mdiAlertCircleOutline} size={18} /> {error}
            </div>
          )}
          <Field label={t('email')}>
            <span className="input-icon">
              <MdiIcon path={mdiEmailOutline} size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
            </span>
          </Field>
          <Field label={t('password')}>
            <span className="input-icon">
              <MdiIcon path={mdiLockOutline} size={18} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </span>
          </Field>
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <MdiIcon path={mdiLogin} size={18} />}
            {busy ? t('loading') : t('signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
