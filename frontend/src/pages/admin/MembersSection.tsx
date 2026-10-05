import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, Select } from '../../components';
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
export function MembersSection({ tags, onTagsChanged }: { tags: AdminTag[]; onTagsChanged: () => void }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Which member's tag is waiting on "Remove / Keep" — removing a label like
  // "low-income" is sensitive enough to deserve a second step.
  const [confirmingRemoval, setConfirmingRemoval] = useState<{ memberId: string; tagId: string } | null>(null);

  // A tag deleted while it's the active filter would otherwise leave the
  // dropdown reading "All members" over a list filtered by a tag that's gone.
  useEffect(() => {
    if (tagFilter && !tags.some((tag) => tag.id === tagFilter)) setTagFilter('');
  }, [tags, tagFilter]);

  // Only typing is debounced: the first load and filter changes fetch at
  // once, rather than every visit paying the typing delay.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Not keyed on the tag list: renames and deletes happen on the Tags tab,
  // and coming back here remounts this section with fresh data.
  useEffect(() => {
    if (!token) return;
    // Set by cleanup once a newer search has started, so a slow, older
    // response that lands late can't overwrite the newer results.
    let superseded = false;
    fetchAdminMembers(token, { q: debouncedQuery, tagId: tagFilter })
      .then((res) => {
        if (!superseded) setMembers(res.members);
      })
      .catch(() => {
        if (!superseded) showToast('Could not load members.', 'error');
      });
    return () => {
      superseded = true;
    };
  }, [token, debouncedQuery, tagFilter, showToast]);

  const selected = members.find((m) => m.id === selectedId) ?? null;

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
    <section className="mb-10">
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
          onChange={setTagFilter}
          options={[{ value: '', label: 'All members' }, ...tags.map((tag) => ({ value: tag.id, label: `Tagged: ${tag.name}` }))]}
          className="sm:w-60"
        />
      </div>

      {members.length === 0 && <p className="text-sm text-text-secondary">No members match.</p>}

      <div className="flex flex-col gap-2">
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
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
