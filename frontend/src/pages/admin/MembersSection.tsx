import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, Select } from '../../components';
import { AwardCreditsForm } from './AwardCreditsForm';
import { MODULE_FRAME, SectionHeading } from './SectionHeading';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { addMemberTag, fetchAdminMembers, removeMemberTag, type AdminMember, type AdminTag } from '../../lib/api';

const FIELD = 'rounded-md border-2 border-border bg-bg-surface px-3 py-2 text-sm text-text-body';
const SEARCH_DEBOUNCE_MS = 300;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function TagChip({ name }: { name: string }) {
  return (
    <span className="rounded-full bg-accent-lime-light px-2 py-0.5 text-xs font-bold text-success">{name}</span>
  );
}

// Admin-only list of Users with search, tag filter, and per-member tagging.
interface MembersSectionProps {
  tags: AdminTag[];
  onTagsChanged: () => void;
  // Bumped by the page when a tag is renamed or deleted, so rows and chips
  // re-fetch. A counter rather than the tag list itself, so the first load
  // isn't fetched twice when the tag list arrives.
  refreshKey?: number;
  // Rendered at the end of the search/filter row (e.g. "Manage tags").
  toolbarAction?: ReactNode;
}

export function MembersSection({ tags, onTagsChanged, refreshKey = 0, toolbarAction }: MembersSectionProps) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const listTop = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Which member's tag is waiting on "Remove / Keep" — removing a label like
  // "low-income" is sensitive enough to deserve a second step.
  const [confirmingRemoval, setConfirmingRemoval] = useState<{ memberId: string; tagId: string } | null>(null);

  // A tag deleted while it's the active filter would otherwise leave the
  // dropdown reading "All members" over a list filtered by a tag that's gone.
  useEffect(() => {
    if (tagFilter && !tags.some((tag) => tag.id === tagFilter)) {
      setTagFilter('');
      setPage(1);
    }
  }, [tags, tagFilter]);

  // Only typing is debounced: the first load and filter changes fetch at
  // once, rather than every visit paying the typing delay. A new search or
  // filter starts again from page 1, set alongside it so only one fetch runs.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim();
      if (next === debouncedQuery) return;
      setDebouncedQuery(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, debouncedQuery]);

  // Not keyed on the tag list itself (see refreshKey): the page bumps
  // refreshKey when a tag is renamed or deleted in the Manage tags panel.
  useEffect(() => {
    if (!token) return;
    // Set by cleanup once a newer search has started, so a slow, older
    // response that lands late can't overwrite the newer results.
    let superseded = false;
    fetchAdminMembers(token, { q: debouncedQuery, tagId: tagFilter, page })
      .then((res) => {
        if (superseded) return;
        setMembers(res.members);
        setTotal(res.total);
        setPageSize(res.pageSize);
      })
      .catch(() => {
        if (!superseded) showToast('Could not load members.', 'error');
      });
    return () => {
      superseded = true;
    };
  }, [token, debouncedQuery, tagFilter, page, refreshKey, showToast]);

  const selected = members.find((m) => m.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // A page left empty (e.g. its last member untagged under a tag filter)
  // steps back to the new last page.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function goToPage(next: number) {
    setPage(next);
    setSelectedId(null);
    listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function change(action: () => Promise<AdminMember>) {
    setBusy(true);
    try {
      const updated = await action();
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      onTagsChanged(); // member counts on the tag list
    } catch {
      showToast('Could not update that member’s tags.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`mb-10 ${MODULE_FRAME}`}>
      <SectionHeading>Member list</SectionHeading>
      <p className="mb-4 text-sm font-medium text-text-secondary">Find a member to see or change their tags.</p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Search members"
          placeholder="Search name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${FIELD} flex-1`}
        />
        <Select
          aria-label="Filter by tag"
          value={tagFilter}
          onChange={(value) => {
            setTagFilter(value);
            setPage(1);
          }}
          options={[{ value: '', label: 'All members' }, ...tags.map((tag) => ({ value: tag.id, label: `Tagged: ${tag.name}` }))]}
          className="sm:w-60"
        />
        {toolbarAction}
      </div>

      {members.length === 0 && <p className="text-sm text-text-secondary">No members match.</p>}

      <div ref={listTop} className="flex scroll-mt-4 flex-col gap-2">
        {members.map((member) => (
          <div key={member.id} className="rounded-md border-2 border-b-4 border-border-strong bg-bg-surface">
            <button
              type="button"
              onClick={() => setSelectedId(selectedId === member.id ? null : member.id)}
              className="flex w-full flex-col items-start gap-1 p-3 text-left"
            >
              <span className="font-bold text-text-heading">{member.name ?? 'No name'}</span>
              <span className="text-xs text-text-secondary">
                {member.email ?? 'No email'} · joined {formatDate(member.joinedAt)} · {member.credits} credit
                {member.credits === 1 ? '' : 's'}
              </span>
              {member.tags.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {member.tags.map((t) => (
                    <TagChip key={t.id} name={t.name} />
                  ))}
                </span>
              )}
            </button>

            {selected?.id === member.id && (
              <div className="flex flex-col gap-2 border-t-2 border-border p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">Tags</p>
                {member.tags.length === 0 && <p className="text-sm text-text-secondary">No tags yet.</p>}
                {member.tags.map((t) =>
                  confirmingRemoval?.memberId === member.id && confirmingRemoval.tagId === t.id ? (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-md bg-warning/10 px-2 py-1.5">
                      <p className="min-w-0 text-sm font-bold text-text-body">
                        Remove "{t.name}" from {member.name ?? member.email ?? 'this member'}?
                      </p>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={async () => {
                            await change(() => removeMemberTag(token!, member.id, t.id));
                            setConfirmingRemoval(null);
                          }}
                        >
                          Remove
                        </Button>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmingRemoval(null)}>
                          Keep
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div key={t.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <TagChip name={t.name} />
                        <p className="mt-0.5 text-xs text-text-secondary">
                          added by {t.addedBy.name}, {formatDate(t.addedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${t.name}`}
                        disabled={busy}
                        onClick={() => setConfirmingRemoval({ memberId: member.id, tagId: t.id })}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-border"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ),
                )}

                {tags.some((tag) => !member.tags.some((t) => t.id === tag.id)) && (
                  <Select
                    aria-label="Add a tag"
                    value=""
                    placeholder="Add a tag…"
                    disabled={busy}
                    onChange={(tagId) => change(() => addMemberTag(token!, member.id, tagId))}
                    options={tags
                      .filter((tag) => !member.tags.some((t) => t.id === tag.id))
                      .map((tag) => ({ value: tag.id, label: tag.name }))}
                  />
                )}

                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-text-secondary">Award credits</p>
                <AwardCreditsForm
                  key={member.id}
                  member={member}
                  onAwarded={(updated) => setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {total > 0 && (
        <nav aria-label="Member list pages" className="mt-4 flex flex-col items-center gap-2">
          {pageCount > 1 && (
            <div className="flex w-full items-center justify-between gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                ‹ Prev
              </Button>
              <span className="text-sm font-bold text-text-body">
                Page {page} of {pageCount}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>
                Next ›
              </Button>
            </div>
          )}
          <p className="text-xs text-text-secondary">
            {total} member{total === 1 ? '' : 's'}
          </p>
        </nav>
      )}
    </section>
  );
}
