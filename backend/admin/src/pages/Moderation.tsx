import { useEffect, useState } from 'react';
import {
  mdiArrowRight,
  mdiCalendarClock,
  mdiFileDocumentOutline,
  mdiMessageTextOutline,
  mdiShieldCheckOutline,
  mdiStar,
  mdiStarOutline,
  mdiTrashCanOutline,
} from '@mdi/js';
import { api } from '../api';
import { useI18n } from '../i18n';
import type { Appointment, Quote, QuoteMessage, Review } from '../types';
import {
  Avatar,
  EmptyState,
  formatDate,
  IconButton,
  Loader,
  Modal,
  PageHead,
  useAction,
  useConfirmDelete,
} from '../ui';
import { MdiIcon } from '../CategoryIcon';

type Tab = 'reviews' | 'quotes' | 'appointments';

const TAB_ICONS: Record<Tab, string> = {
  reviews: mdiStarOutline,
  quotes: mdiFileDocumentOutline,
  appointments: mdiCalendarClock,
};

function Stars({ value }: { value: number }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? '' : 'off'}>
          <MdiIcon path={mdiStar} size={15} />
        </span>
      ))}
    </span>
  );
}

function Who({ name, phone, garage }: { name: string; phone?: string; garage: string }) {
  return (
    <div className="cell-main">
      <Avatar name={name} size={34} />
      <div>
        <strong style={{ fontSize: 13.5 }}>
          {name} {phone && <span className="sub">· {phone}</span>}
        </strong>
        <div className="sub cat-inline">
          <MdiIcon path={mdiArrowRight} size={13} /> {garage}
        </div>
      </div>
    </div>
  );
}

export function Moderation() {
  const { t, lang } = useI18n();
  const { run } = useAction();
  const confirmDelete = useConfirmDelete();
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

  const remove = async (path: string) => {
    if (!(await confirmDelete())) return;
    run(async () => {
      await api(path, { method: 'DELETE' });
      load(tab);
    }, 'deleted');
  };

  const rows = tab === 'reviews' ? reviews : tab === 'quotes' ? quotes : appointments;

  return (
    <>
      <PageHead title={t('navModeration')} icon={mdiShieldCheckOutline} />
      <div className="tabs">
        {(['reviews', 'quotes', 'appointments'] as Tab[]).map((x) => (
          <button key={x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>
            <MdiIcon path={TAB_ICONS[x]} size={17} />
            {t(x === 'reviews' ? 'tabReviews' : x === 'quotes' ? 'tabQuotes' : 'tabAppointments')}
          </button>
        ))}
      </div>

      <div className="card card-flush">
        <table>
          <tbody>
            {tab === 'reviews' &&
              reviews?.map((r) => (
                <tr key={r.id}>
                  <td style={{ width: 280 }}>
                    <Who name={r.authorName} garage={r.garageName} />
                  </td>
                  <td>
                    <Stars value={r.rating} />
                    <div style={{ marginTop: 3 }}>{r.comment}</div>
                    <div className="sub">{formatDate(r.createdAt, lang)}</div>
                  </td>
                  <td className="actions">
                    <IconButton
                      icon={mdiTrashCanOutline}
                      tone="danger"
                      label={t('delete')}
                      onClick={() => remove(`/reviews/${r.id}`)}
                    />
                  </td>
                </tr>
              ))}
            {tab === 'quotes' &&
              quotes?.map((q) => (
                <tr key={q.id}>
                  <td style={{ width: 280 }}>
                    <Who name={q.clientName} phone={q.clientPhone} garage={q.garageName} />
                  </td>
                  <td>
                    <div>{q.description}</div>
                    <div className="meta">
                      <span>{formatDate(q.createdAt, lang)}</span>
                      <span className="chip chip-muted">{q.status}</span>
                      <span>
                        <MdiIcon path={mdiMessageTextOutline} size={13} /> {q.messageCount}
                      </span>
                    </div>
                  </td>
                  <td className="actions">
                    <div className="actions-group">
                      <IconButton
                        icon={mdiMessageTextOutline}
                        tone="primary"
                        label={t('messages')}
                        onClick={() =>
                          api<QuoteMessage[]>(`/quotes/${q.id}/messages`).then((messages) =>
                            setThread({ quote: q, messages })
                          )
                        }
                      />
                      <IconButton
                        icon={mdiTrashCanOutline}
                        tone="danger"
                        label={t('delete')}
                        onClick={() => remove(`/quotes/${q.id}`)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            {tab === 'appointments' &&
              appointments?.map((a) => (
                <tr key={a.id}>
                  <td style={{ width: 280 }}>
                    <Who name={a.clientName} phone={a.clientPhone} garage={a.garageName} />
                  </td>
                  <td>
                    <div className="cat-inline">
                      <MdiIcon path={mdiCalendarClock} size={15} /> <strong>{a.slot}</strong>
                      {a.note ? ` — ${a.note}` : ''}
                    </div>
                    <div className="meta">
                      <span>{formatDate(a.createdAt, lang)}</span>
                      <span className="chip chip-muted">{a.status}</span>
                    </div>
                  </td>
                  <td className="actions">
                    <IconButton
                      icon={mdiTrashCanOutline}
                      tone="danger"
                      label={t('delete')}
                      onClick={() => remove(`/appointments/${a.id}`)}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {rows && rows.length === 0 && <EmptyState text={t('noResults')} icon={TAB_ICONS[tab]} />}
        {!rows && <Loader />}
      </div>

      {thread && (
        <Modal
          title={`${thread.quote.clientName} → ${thread.quote.garageName}`}
          onClose={() => setThread(null)}
          icon={mdiMessageTextOutline}
        >
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
