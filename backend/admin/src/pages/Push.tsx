import { useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Field, PageHead, useAction, useToast } from '../ui';
import { mdiAccountGroupOutline, mdiBullhornOutline, mdiCellphone, mdiSend } from '@mdi/js';
import { MdiIcon } from '../CategoryIcon';

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
      toast(t('sentTo', { n: res.sent }), 'ok', t('navPush'));
      setTitle('');
      setBody('');
    }, null);

  return (
    <>
      <PageHead title={t('navPush')} icon={mdiBullhornOutline} />
      <div className="grid grid-2" style={{ alignItems: 'start', maxWidth: 980 }}>
      <div className="card">
        <div className="card-title">
          <MdiIcon path={mdiAccountGroupOutline} size={20} />
          <h3>{t('audience')}</h3>
        </div>
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
              <MdiIcon path={mdiSend} size={17} /> {t('send')}
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">
          <MdiIcon path={mdiCellphone} size={20} />
          <h3>{t('preview')}</h3>
        </div>
        <div className="push-preview">
          <span className="push-app">
            <img src="/api/config/logo" alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
          </span>
          <div>
            <div className="push-meta">Mekano · {t('now')}</div>
            <strong>{title || t('pushTitle')}</strong>
            <div className="sub">{body || t('pushBody')}</div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
