import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, CreditCard, LifeBuoy, MoreHorizontal, Smartphone, UserRound, Users } from 'lucide-react';
import { Button, PageHeader, Select } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import {
  createSupportTicket,
  fetchMySupportTickets,
  fetchUserLessons,
  type LessonWithBuddy,
  type SupportTicket,
  type SupportTopic,
} from '../../lib/api';
import { formatDateTime } from '../../lib/formatDateTime';
import { StatusBadge, SupportThread, TOPIC_LABELS } from './SupportThread';

const TOPIC_ICONS: Record<SupportTopic, typeof CreditCard> = {
  payment: CreditCard,
  lesson: CalendarDays,
  buddy: Users,
  account: UserRound,
  app: Smartphone,
  other: MoreHorizontal,
};

const FIELD = 'w-full rounded-md border-2 border-border bg-bg-surface px-3 py-2 text-sm text-text-body';

function NewTicketForm({ onSent, onCancel }: { onSent: (ticket: SupportTicket) => void; onCancel: () => void }) {
  const { token, account } = useAuth();
  const { showToast } = useToast();
  const [topic, setTopic] = useState<SupportTopic | null>(null);
  const [message, setMessage] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [lessons, setLessons] = useState<LessonWithBuddy[]>([]);
  const [busy, setBusy] = useState(false);

  // Members can point at one of their lessons; loaded only when it's relevant.
  useEffect(() => {
    if (topic !== 'lesson' && topic !== 'buddy') return;
    if (!token || account?.role !== 'user' || lessons.length > 0) return;
    fetchUserLessons(token)
      .then((res) => setLessons([...res.upcoming, ...res.previous]))
      .catch(() => {});
  }, [topic, token, account?.role, lessons.length]);

  async function send() {
    if (!token || !topic || !message.trim()) return;
    setBusy(true);
    try {
      onSent(await createSupportTicket(token, { topic, message: message.trim(), lessonId: lessonId || undefined }));
      showToast('Sent! We’ll reply here and by email.', 'success');
    } catch {
      showToast('Could not send your question. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">What is it about?</p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(TOPIC_LABELS) as SupportTopic[]).map((t) => {
          const Icon = TOPIC_ICONS[t];
          return (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
              className={
                topic === t
                  ? 'flex items-center gap-2 rounded-md border-2 border-b-[3px] border-brand-primary-border bg-brand-primary px-3 py-2.5 text-left text-sm font-bold text-text-inverse'
                  : 'flex items-center gap-2 rounded-md border-2 border-b-[3px] border-border bg-bg-surface px-3 py-2.5 text-left text-sm font-bold text-text-heading'
              }
            >
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              {TOPIC_LABELS[t]}
            </button>
          );
        })}
      </div>

      {lessons.length > 0 && (topic === 'lesson' || topic === 'buddy') && (
        <Select
          aria-label="Which lesson? (optional)"
          value={lessonId}
          onChange={setLessonId}
          options={[
            { value: '', label: 'Which lesson? (optional)' },
            ...lessons.map((l) => ({ value: l.id, label: `${formatDateTime(l.startTime)} · ${l.buddyName}` })),
          ]}
        />
      )}

      <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Tell us what happened</p>
      <textarea
        aria-label="Your message"
        placeholder="Write in your own words. Short is fine."
        maxLength={2000}
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className={FIELD}
      />
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy || !topic || !message.trim()} onClick={send}>
          {busy ? 'Sending…' : 'Send'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Members and Buddies: ask for help, and follow their questions.
export function SupportScreen() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  // ?ticket=<id> (from a reply notification) opens that one.
  const [openId, setOpenId] = useState<string | null>(params.get('ticket'));

  useEffect(() => {
    if (!token) return;
    fetchMySupportTickets(token)
      .then((res) => setTickets(res.tickets))
      .catch(() => showToast('Could not load your questions.', 'error'));
  }, [token, showToast]);

  function replace(updated: SupportTicket) {
    setTickets((prev) => [updated, ...(prev ?? []).filter((t) => t.id !== updated.id)]);
  }

  return (
    <main className="mx-auto max-w-3xl pb-10">
      <PageHeader
        title="Help"
        right={
          <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
            Back
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-5 pt-2">
        <p className="text-sm font-medium text-text-secondary">
          Having a problem? Send us a question. We reply here and by email.
        </p>

        {isAsking ? (
          <NewTicketForm
            onCancel={() => setIsAsking(false)}
            onSent={(ticket) => {
              replace(ticket);
              setIsAsking(false);
              setOpenId(ticket.id);
            }}
          />
        ) : (
          <Button onClick={() => setIsAsking(true)}>+ Ask a question</Button>
        )}

        <h2 className="mt-2 text-xs font-bold uppercase tracking-widest text-text-secondary">Your questions</h2>
        {tickets === null && <p className="text-sm text-text-secondary">Loading…</p>}
        {tickets?.length === 0 && (
          <div className="py-8 text-center">
            <LifeBuoy size={36} className="mx-auto mb-2 text-text-secondary" aria-hidden="true" />
            <p className="text-sm font-bold text-text-secondary">No questions yet.</p>
          </div>
        )}
        {tickets?.map((t) => {
          const last = t.messages[t.messages.length - 1];
          const open = openId === t.id;
          return (
            <div key={t.id} className="rounded-md border-2 border-b-4 border-border-strong bg-bg-surface">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : t.id)}
                className="flex w-full flex-col gap-1 p-3 text-left"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-bold text-text-heading">{TOPIC_LABELS[t.topic]}</span>
                  <StatusBadge status={t.status} />
                </span>
                <span className="line-clamp-2 text-sm text-text-body">
                  {last.from === 'admin' && <span className="font-bold text-brand-secondary">Team: </span>}
                  {last.body}
                </span>
                <span className="text-xs text-text-secondary">{formatDateTime(t.lastActivityAt)}</span>
              </button>
              {open && (
                <div className="border-t-2 border-border p-3">
                  <SupportThread ticket={t} viewer="sender" onUpdated={replace} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
