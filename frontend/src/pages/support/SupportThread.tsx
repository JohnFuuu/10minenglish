import { useState } from 'react';
import { Button } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { replyToSupportTicket, type SupportStatus, type SupportTicket, type SupportTopic } from '../../lib/api';
import { formatDateTime } from '../../lib/formatDateTime';

// Plain words, for learners still building their English.
export const TOPIC_LABELS: Record<SupportTopic, string> = {
  payment: 'Payment & credits',
  lesson: 'A meeting',
  buddy: 'My Buddy',
  account: 'My account',
  app: 'App problem',
  other: 'Other',
};

const STATUS_STYLE: Record<SupportStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-warning/15 text-warning' },
  answered: { label: 'Answered', className: 'bg-accent-lime-light text-success' },
  closed: { label: 'Closed', className: 'bg-border/60 text-text-secondary' },
};

export function StatusBadge({ status }: { status: SupportStatus }) {
  const { label, className } = STATUS_STYLE[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${className}`}>{label}</span>;
}

const FIELD = 'w-full rounded-md border-2 border-border bg-bg-surface px-3 py-2 text-sm text-text-body';

// The messages of one ticket, oldest first, and a reply box. `viewer` decides
// which side's bubbles sit on the right ("me").
export function SupportThread({
  ticket,
  viewer,
  onUpdated,
}: {
  ticket: SupportTicket;
  viewer: 'sender' | 'admin';
  onUpdated: (ticket: SupportTicket) => void;
}) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!token || !reply.trim()) return;
    setBusy(true);
    try {
      onUpdated(await replyToSupportTicket(token, ticket.id, reply.trim()));
      setReply('');
    } catch {
      showToast('Could not send your message. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {ticket.lesson && (
        <p className="text-xs font-bold text-text-secondary">
          About the meeting with {ticket.lesson.buddyName} on {formatDateTime(ticket.lesson.startTime)}
        </p>
      )}
      {ticket.messages.map((m, i) => {
        const mine = m.from === viewer;
        return (
          <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-md px-3 py-2 ${
                m.from === 'admin' ? 'bg-brand-secondary/10' : 'bg-border/40'
              }`}
            >
              <p className="text-xs font-bold text-text-secondary">
                {m.from === 'admin' ? (viewer === 'admin' ? m.authorName : '10 Minute English team') : m.authorName} ·{' '}
                {formatDateTime(m.createdAt)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text-body">{m.body}</p>
            </div>
          </div>
        );
      })}
      <textarea
        aria-label="Your reply"
        placeholder={viewer === 'admin' ? 'Reply to them…' : 'Write a reply…'}
        maxLength={2000}
        rows={3}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        className={`${FIELD} mt-1`}
      />
      <Button size="sm" disabled={busy || !reply.trim()} onClick={send}>
        {busy ? 'Sending…' : 'Send reply'}
      </Button>
      {viewer === 'sender' && ticket.status === 'closed' && (
        <p className="text-xs font-medium text-text-secondary">This question is closed. Replying opens it again.</p>
      )}
    </div>
  );
}
