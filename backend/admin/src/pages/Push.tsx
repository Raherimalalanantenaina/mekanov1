import { useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Field, useAction, useToast } from '../ui';

type Audience = 'all' | 'clients' | 'garages';

export function Push() {
  const { t } = useI18n();
  const toast = useToast();
  const { run, busy } = useAction();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');

  const send = () =>
    run(async () => {
      const res = await api<{ sent: number }>('/push', { method: 'POST', body: { title, body, audience } });
      toast(t('sentTo', { n: res.sent }));
      setTitle('');
      setBody('');
    }, null);

  return (
    <>
      <div className="page-head">
        <h1>{t('navPush')}</h1>
      </div>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="grid">
          <Field label={t('audience')}>
            <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
              <option value="all">{t('aud_all')}</option>
              <option value="clients">{t('aud_clients')}</option>
              <option value="garages">{t('aud_garages')}</option>
            </select>
          </Field>
          <Field label={t('pushTitle')} hint={`${title.length}/80`}>
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('pushBody')} hint={`${body.length}/300`}>
            <textarea value={body} maxLength={300} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <div>
            <button className="btn btn-primary" disabled={busy || !title.trim() || !body.trim()} onClick={send}>
              {t('send')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
