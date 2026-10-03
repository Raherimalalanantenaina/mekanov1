import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import type { Appointment, Quote, QuoteMessage, Review } from '../types';
import { formatDate, Modal, useAction } from '../ui';

type Tab = 'reviews' | 'quotes' | 'appointments';

export function Moderation() {
  const { t, lang } = useI18n();
  const { run } = useAction();
  const [tab, setTab] = useState<Tab>('reviews');
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [thread, setThread] = useState<{ quote: Quote; messages: QuoteMessage[] } | null>(null);

  const load = (which: Tab) => {
    if (which === 'reviews') api<Review[]>('/reviews').then(setReviews);
    if (which === 'quotes') api<Quote[]>('/quotes').then(setQuotes);
    if (which === 'appointments') api<Appointment[]>('/appointments').then(setAppointments);
  };

  useEffect(() => load(tab), [tab]);

  const remove = (path: string) => {
    if (!confirm(t('confirmDelete'))) return;
    run(async () => {
      await api(path, { method: 'DELETE' });
      load(tab);
    });
  };

  const rows = tab === 'reviews' ? reviews : tab === 'quotes' ? quotes : appointments;

  return (
    <>
      <div className="page-head">
        <h1>{t('navModeration')}</h1>
      </div>
      <div className="tabs">
        {(['reviews', 'quotes', 'appointments'] as Tab[]).map((x) => (
          <button key={x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>
            {t(x === 'reviews' ? 'tabReviews' : x === 'quotes' ? 'tabQuotes' : 'tabAppointments')}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <tbody>
            {tab === 'reviews' &&
              reviews?.map((r) => (
                <tr key={r.id}>
                  <td style={{ width: 90 }}>{'★'.repeat(r.rating)}</td>
                  <td>
                    <strong>{r.authorName}</strong> → {r.garageName}
                    <div>{r.comment}</div>
                    <div className="sub">{formatDate(r.createdAt, lang)}</div>
                  </td>
                  <td className="actions">
                    <button className="btn btn-sm btn-danger" onClick={() => remove(`/reviews/${r.id}`)}>
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            {tab === 'quotes' &&
              quotes?.map((q) => (
                <tr key={q.id}>
                  <td>
                    <strong>{q.clientName}</strong> {q.clientPhone && <span className="sub">({q.clientPhone})</span>} →{' '}
                    {q.garageName}
                    <div>{q.description}</div>
                    <div className="sub">
                      {formatDate(q.createdAt, lang)} · {q.status} · {q.messageCount} {t('messages').toLowerCase()}
                    </div>
                  </td>
                  <td className="actions">
                    <button
                      className="btn btn-sm"
                      onClick={() =>
                        api<QuoteMessage[]>(`/quotes/${q.id}/messages`).then((messages) => setThread({ quote: q, messages }))
                      }
                    >
                      {t('messages')}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(`/quotes/${q.id}`)}>
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            {tab === 'appointments' &&
              appointments?.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.clientName}</strong> {a.clientPhone && <span className="sub">({a.clientPhone})</span>} →{' '}
                    {a.garageName}
                    <div>
                      {t('slot')} : {a.slot}
                      {a.note ? ` — ${a.note}` : ''}
                    </div>
                    <div className="sub">
                      {formatDate(a.createdAt, lang)} · {a.status}
                    </div>
                  </td>
                  <td className="actions">
                    <button className="btn btn-sm btn-danger" onClick={() => remove(`/appointments/${a.id}`)}>
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {rows && rows.length === 0 && <div className="empty">{t('noResults')}</div>}
        {!rows && <div className="empty">{t('loading')}</div>}
      </div>

      {thread && (
        <Modal title={`${thread.quote.clientName} → ${thread.quote.garageName}`} onClose={() => setThread(null)}>
          <div className="messages">
            {thread.messages.map((m) => (
              <div key={m.id} className={`message ${m.sender}`}>
                {m.body}
                {m.photo && <img src={m.photo} alt="" />}
                <div className="sub">{formatDate(m.createdAt, lang)}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
