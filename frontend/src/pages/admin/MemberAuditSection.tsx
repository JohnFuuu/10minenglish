import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { fetchMemberAuditLog, type AdminTag, type AuditLogEntry } from '../../lib/api';
import { describeAuditEntry, formatWhen } from './AuditLogSection';
import { MODULE_FRAME, SectionHeading } from './SectionHeading';

// The Members tab's audit: only member actions (tags added/removed, credits
// awarded), and only for the members the list above is showing — it follows
// the same search box and tag filter. The full log is on the Admins tab.
export function MemberAuditSection({
  q,
  tagId,
  tags,
  refreshKey,
}: {
  q: string;
  tagId: string;
  tags: AdminTag[];
  refreshKey: number;
}) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // A response for an older filter is dropped, so pages never mix.
  const generation = useRef(0);

  useEffect(() => {
    if (!token) return;
    const current = ++generation.current;
    setIsLoaded(false);
    setIsLoadingMore(false);
    fetchMemberAuditLog(token, { q, tagId })
      .then((res) => {
        if (current !== generation.current) return;
        setEntries(res.entries);
        setNextCursor(res.nextCursor);
        setIsLoaded(true);
      })
      .catch(() => {
        if (current === generation.current) showToast('Could not load the member audit.', 'error');
      });
  }, [token, q, tagId, refreshKey, showToast]);

  async function loadMore() {
    if (!token || !nextCursor || isLoadingMore) return;
    const current = generation.current;
    setIsLoadingMore(true);
    try {
      const res = await fetchMemberAuditLog(token, { q, tagId, before: nextCursor });
      if (current !== generation.current) return;
      setEntries((prev) => [...prev, ...res.entries]);
      setNextCursor(res.nextCursor);
    } catch {
      if (current === generation.current) showToast('Could not load more entries.', 'error');
    } finally {
      if (current === generation.current) setIsLoadingMore(false);
    }
  }

  const tagName = tags.find((t) => t.id === tagId)?.name;
  const scope = [q && `matching “${q}”`, tagName && `tagged ${tagName}`].filter(Boolean).join(', ');

  return (
    <section className={`mb-10 ${MODULE_FRAME}`}>
      <SectionHeading>Audit</SectionHeading>
      <p className="mb-4 text-sm font-medium text-text-secondary">
        Tag and credit changes for {scope ? `members ${scope}` : 'all members'}, newest first.
      </p>

      {!isLoaded && entries.length === 0 && <p className="text-sm text-text-secondary">Loading…</p>}
      {isLoaded && entries.length === 0 && <p className="text-sm text-text-secondary">Nothing recorded for these members.</p>}

      {entries.length > 0 && (
        <ul
          className={`divide-y-2 divide-border overflow-hidden rounded-md border-2 border-b-4 border-border-strong bg-bg-surface ${
            isLoaded ? '' : 'opacity-60'
          }`}
        >
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
