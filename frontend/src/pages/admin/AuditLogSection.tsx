import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, CreditCoin, Select } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { fetchAuditLog, type AuditLogEntry } from '../../lib/api';
import { MODULE_FRAME, SectionHeading } from './SectionHeading';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'tags', label: 'Tags' },
  { value: 'memberTags', label: 'Member tags' },
  { value: 'credits', label: 'Credit awards' },
  { value: 'buddies', label: 'Buddies' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'admins', label: 'Admins' },
  { value: 'support', label: 'Support' },
];

const dollars = (cents: unknown) => `$${(Number(cents) / 100).toFixed(2)}`;
const plural = (n: unknown, word: string) => `${Number(n)} ${word}${Number(n) === 1 ? '' : 's'}`;

// One entry in the house format:
//   Actor-role (Name) verb Target-type (Name) with (details)
// e.g. "Admin (James) removed Tag (Test Users) from Member (James Stone)".
// Roles: SuperAdmin / Admin, as they were when the entry was recorded.

// "Admin (James)" — the role plain, the name in bold.
function Party({ role, name }: { role: string; name: string }) {
  return (
    <>
      {role} (<strong className="text-text-heading">{name}</strong>)
    </>
  );
}

// " with (…)" — the extra facts, kept visually quieter than the main sentence.
function With({ children }: { children: ReactNode }) {
  return <span className="text-text-secondary"> with ({children})</span>;
}

export function describeAuditEntry(entry: AuditLogEntry): ReactNode {
  const d = entry.details;
  const actor = <Party role={entry.admin.superAdmin ? 'SuperAdmin' : 'Admin'} name={entry.admin.name} />;
  const label = entry.target.label;
  const member = <Party role="Member" name={label} />;
  const buddy = <Party role="Buddy" name={label} />;
  const tag = <Party role="Tag" name={label} />;
  const memberTag = <Party role="Tag" name={String(d.tag ?? '')} />;
  const adminTarget = <Party role={entry.target.superAdmin ? 'SuperAdmin' : 'Admin'} name={label} />;
  const cancelled = (n: unknown) => <With>{plural(n, 'upcoming meeting')} cancelled and refunded</With>;

  switch (entry.action) {
    case 'tag.created':
      return <>{actor} created {tag}</>;
    case 'tag.renamed':
      return (
        <>
          {actor} modified {tag}
          <With>
            name “{String(d.from)}” → “{String(d.to)}”
          </With>
        </>
      );
    case 'tag.deleted':
      return (
        <>
          {actor} removed {tag}
          <With>taken off {plural(d.removedFromMembers, 'member')}</With>
        </>
      );
    case 'member.tag_added':
      return <>{actor} added {memberTag} to {member}</>;
    case 'member.tag_removed':
      return <>{actor} removed {memberTag} from {member}</>;
    case 'member.credits_awarded':
      return (
        <>
          {actor} added <Party role="Credits" name={String(Number(d.amount))} /> for {member}
          <With>
            reason “{String(d.reason)}”; balance now <CreditCoin className="-mt-0.5" /> {Number(d.balanceAfter)}
          </With>
        </>
      );
    case 'buddy.created':
      return <>{actor} created {buddy}</>;
    case 'buddy.activated':
      return <>{actor} activated {buddy}</>;
    case 'buddy.deactivated':
      return <>{actor} deactivated {buddy}{cancelled(d.cancelledLessons)}</>;
    case 'buddy.removed':
      return <>{actor} removed {buddy}{cancelled(d.cancelledLessons)}</>;
    case 'price.changed':
      return (
        <>
          {actor} modified <Party role="Top-Up" name={`${Number(d.packSize ?? entry.target.id)} Credits`} />
          <With>
            price {dollars(d.fromCents)} → {dollars(d.toCents)}
          </With>
        </>
      );
    case 'lesson_price.changed':
      return (
        <>
          {actor} modified <Party role="Meeting" name="Cost" />
          <With>
            {plural(d.from, 'credit')} → {plural(d.to, 'credit')}
          </With>
        </>
      );
    case 'support.replied':
      return <>{actor} replied to <Party role="Support Ticket" name={label} /></>;
    case 'support.closed':
      return <>{actor} closed <Party role="Support Ticket" name={label} /></>;
    case 'support.reopened':
      return <>{actor} reopened <Party role="Support Ticket" name={label} /></>;
    case 'admin.created':
      return <>{actor} created {adminTarget}</>;
    case 'admin.deactivated':
      return <>{actor} deactivated {adminTarget}</>;
    case 'admin.activated':
      return <>{actor} activated {adminTarget}</>;
    case 'admin.removed':
      return <>{actor} removed {adminTarget}</>;
    default:
      return (
        <>
          {actor} · {entry.action} · {label}
        </>
      );
  }
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Read-only history of every Admin change (append-only on the backend),
// shown as a module on the ADMINS tab. `refreshKey` reloads it after a
// change made on the same page (e.g. adding an Admin).
export function AuditLogSection({ refreshKey = 0 }: { refreshKey?: number }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [category, setCategory] = useState('');
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Bumped on every filter change; a response from an older generation (a
  // first page or a Load more for the previous filter) is dropped, so pages
  // from different filters can never mix.
  const generation = useRef(0);

  useEffect(() => {
    if (!token) return;
    const current = ++generation.current;
    setEntries([]);
    setNextCursor(null);
    setIsLoaded(false);
    setIsLoadingMore(false);
    fetchAuditLog(token, { category })
      .then((res) => {
        if (current !== generation.current) return;
        setEntries(res.entries);
        setNextCursor(res.nextCursor);
        setIsLoaded(true);
      })
      .catch(() => {
        if (current === generation.current) showToast('Could not load the audit log.', 'error');
      });
  }, [token, category, refreshKey, showToast]);

  async function loadMore() {
    if (!token || !nextCursor || isLoadingMore) return;
    const current = generation.current;
    setIsLoadingMore(true);
    try {
      const res = await fetchAuditLog(token, { category, before: nextCursor });
      if (current !== generation.current) return;
      setEntries((prev) => [...prev, ...res.entries]);
      setNextCursor(res.nextCursor);
    } catch {
      if (current === generation.current) showToast('Could not load more entries.', 'error');
    } finally {
      if (current === generation.current) setIsLoadingMore(false);
    }
  }

  return (
    <section id="audit-log" className={MODULE_FRAME}>
      <SectionHeading>Audit log</SectionHeading>
      <p className="mb-4 text-sm font-medium text-text-secondary">Every change made by an Admin, newest first.</p>
      <Select aria-label="Filter actions" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} className="mb-4" />

      {isLoaded && entries.length === 0 && <p className="text-sm text-text-secondary">Nothing recorded yet.</p>}

      {entries.length > 0 && (
        <ul className="divide-y-2 divide-border overflow-hidden rounded-md border-2 border-b-4 border-border-strong bg-bg-surface">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-2.5">
              <p className="text-sm text-text-body">{describeAuditEntry(entry)}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{formatWhen(entry.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {isLoaded && nextCursor && (
        <Button variant="secondary" className="mt-4 w-full" disabled={isLoadingMore} onClick={loadMore}>
          {isLoadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </section>
  );
}
