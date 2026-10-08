import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Select } from '../../components';
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
];

const dollars = (cents: unknown) => `$${(Number(cents) / 100).toFixed(2)}`;
const plural = (n: unknown, word: string) => `${Number(n)} ${word}${Number(n) === 1 ? '' : 's'}`;

// One entry as a plain sentence, e.g. "Ada added low-income to Sarah".
function describe(entry: AuditLogEntry): ReactNode {
  const who = entry.admin.name;
  const target = <strong className="text-text-heading">{entry.target.label}</strong>;
  const tag = <strong className="text-text-heading">{String(entry.details.tag ?? '')}</strong>;
  switch (entry.action) {
    case 'tag.created':
      return <>{who} created tag {target}</>;
    case 'tag.renamed':
      return (
        <>
          {who} renamed tag <strong className="text-text-heading">{String(entry.details.from)}</strong> to{' '}
          <strong className="text-text-heading">{String(entry.details.to)}</strong>
        </>
      );
    case 'tag.deleted':
      return <>{who} deleted tag {target} (removed from {plural(entry.details.removedFromMembers, 'member')})</>;
    case 'member.tag_added':
      return <>{who} added {tag} to {target}</>;
    case 'member.tag_removed':
      return <>{who} removed {tag} from {target}</>;
    case 'member.credits_awarded':
      return (
        <>
          {who} awarded {plural(entry.details.amount, 'credit')} to {target} — “{String(entry.details.reason)}” (balance now{' '}
          {Number(entry.details.balanceAfter)})
        </>
      );
    case 'buddy.created':
      return <>{who} created Buddy account {target}</>;
    case 'buddy.activated':
      return <>{who} activated {target}</>;
    case 'buddy.deactivated':
      return <>{who} deactivated {target} ({plural(entry.details.cancelledLessons, 'upcoming lesson')} cancelled and refunded)</>;
    case 'buddy.removed':
      return <>{who} removed Buddy {target} ({plural(entry.details.cancelledLessons, 'upcoming lesson')} cancelled and refunded)</>;
    case 'price.changed':
      return <>{who} changed {target} from {dollars(entry.details.fromCents)} to {dollars(entry.details.toCents)}</>;
    case 'lesson_price.changed':
      return (
        <>
          {who} changed the lesson price from {plural(entry.details.from, 'credit')} to {plural(entry.details.to, 'credit')}
        </>
      );
    case 'admin.created':
      return <>{who} created Admin account {target}</>;
    case 'admin.deactivated':
      return <>{who} deactivated Admin {target}</>;
    case 'admin.activated':
      return <>{who} activated Admin {target}</>;
    case 'admin.removed':
      return <>{who} removed Admin {target}</>;
    default:
      return <>{who} · {entry.action} · {target}</>;
  }
}

function formatWhen(iso: string): string {
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
              <p className="text-sm text-text-body">{describe(entry)}</p>
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
