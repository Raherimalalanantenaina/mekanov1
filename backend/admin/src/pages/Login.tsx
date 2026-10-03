import { useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Field } from '../ui';

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
      <form className="login-card" onSubmit={submit}>
        <div className="row">
          <h1 style={{ flex: 1 }}>Mekano</h1>
          <button type="button" className="btn btn-sm" onClick={() => setLang(lang === 'fr' ? 'mg' : 'fr')}>
            {lang === 'fr' ? 'MG' : 'FR'}
          </button>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {t('login')}
        </p>
        {error && <div className="error">{error}</div>}
        <Field label={t('email')}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </Field>
        <Field label={t('password')}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? t('loading') : t('signIn')}
        </button>
      </form>
    </div>
  );
}
