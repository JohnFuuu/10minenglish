import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Inbox } from 'lucide-react';
import { Button } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { adminFetchSupportTickets, adminSetSupportTicketStatus, type SupportStatus, type SupportTicket } from '../../lib/api';
import { formatDateTime } from '../../lib/formatDateTime';
import { StatusBadge, SupportThread, TOPIC_LABELS } from '../support/SupportThread';
import { AdminLayout } from './AdminLayout';
import { MODULE_FRAME, SectionHeading } from './SectionHeading';

const FILTERS: { value: SupportStatus | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'answered', label: 'Answered' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

// The SUPPORT tab: every member's and Buddy's question, newest activity
// first. Open (waiting on us) is the default view.
export function AdminSupportPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<SupportStatus | 'all'>('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof adminFetchSupportTickets>> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setData(await adminFetchSupportTickets(token, { status: filter === 'all' ? undefined : filter, page }));
    } catch {
      showToast('Could not load support tickets.', 'error');
    }
  }, [token, filter, page, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // A reply or status change can move a ticket out of the current filter,
  // so refresh the list (and counts) rather than patching it in place.
  async function updated(ticket: SupportTicket) {
    setData((prev) => prev && { ...prev, tickets: prev.tickets.map((t) => (t.id === ticket.id ? ticket : t)) });
    await load();
  }

  async function setStatus(ticket: SupportTicket, status: 'open' | 'closed') {
    if (!token) return;
    setBusyId(ticket.id);
    try {
      await updated(await adminSetSupportTicketStatus(token, ticket.id, status));
      showToast(status === 'closed' ? 'Ticket closed.' : 'Ticket reopened.', 'success');
    } catch {
      showToast('Could not update that ticket.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminLayout title="Support">
      <section className={`mb-10 ${MODULE_FRAME}`}>
        <SectionHeading>Support tickets</SectionHeading>
        <p className="mb-4 text-sm font-medium text-text-secondary">
          Questions from members and Buddies. Replying marks a ticket Answered and emails them.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count = f.value === 'all' ? undefined : data?.counts[f.value];
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => {
                  setFilter(f.value);
                  setPage(1);
                  setOpenId(null);
                }}
                className={
                  filter === f.value
                    ? 'rounded-full border-2 border-brand-secondary bg-brand-secondary px-3 py-1 text-xs font-bold text-text-inverse'
                    : 'rounded-full border-2 border-border bg-bg-surface px-3 py-1 text-xs font-bold text-text-heading'
                }
              >
                {f.label}
                {count !== undefined && ` (${count})`}
              </button>
            );
          })}
        </div>

        {data && data.tickets.length === 0 && (
          <div className="rounded-md bg-border/30 px-4 py-8 text-center">
            {filter === 'open' ? (
              <CheckCircle2 size={36} className="mx-auto mb-2 text-brand-primary" aria-hidden="true" />
            ) : (
              <Inbox size={36} className="mx-auto mb-2 text-text-secondary" aria-hidden="true" />
            )}
            <p className="text-sm font-bold uppercase tracking-widest text-text-secondary">
              {filter === 'open' ? 'All caught up!' : 'No tickets here'}
            </p>
            {filter === 'open' && (
              <p className="mt-1 text-xs font-medium text-text-secondary">No questions are waiting for a reply.</p>
            )}
          </div>
        )}

        {data && data.tickets.length > 0 && (
          <ul className="divide-y-2 divide-border overflow-hidden rounded-md border-2 border-border">
            {data?.tickets.map((t) => {
              const open = openId === t.id;
              const last = t.messages[t.messages.length - 1];
              return (
                <li key={t.id} className="bg-bg-surface">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : t.id)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left"
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-bold text-text-heading">
                        {TOPIC_LABELS[t.topic]} · {t.sender.name}
                      </span>
                      <StatusBadge status={t.status} />
                    </span>
                    <span className="line-clamp-2 text-sm text-text-body">{last.body}</span>
                    <span className="text-xs text-text-secondary">
                      {t.sender.role === 'buddy' ? 'Buddy' : 'Member'}
                      {t.sender.email && ` · ${t.sender.email}`} · {formatDateTime(t.lastActivityAt)}
                    </span>
                  </button>
                  {open && (
                    <div className="border-t-2 border-border px-4 py-3">
                      <SupportThread ticket={t} viewer="admin" onUpdated={updated} />
                      <div className="mt-3 flex justify-end">
                        {t.status === 'closed' ? (
                          <Button variant="secondary" size="sm" disabled={busyId === t.id} onClick={() => setStatus(t, 'open')}>
                            Reopen
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" disabled={busyId === t.id} onClick={() => setStatus(t, 'closed')}>
                            Close ticket
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ‹ Prev
            </Button>
            <span className="text-sm font-bold text-text-body">
              Page {page} of {pageCount}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
              Next ›
            </Button>
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
