import { useState } from 'react';
import { Button, Input } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { ApiError, createAdminTag, deleteAdminTag, renameAdminTag, type AdminTag } from '../../lib/api';

const SECTION_HEADING =
  'mb-1 inline-block rounded-md bg-accent-lime-light px-3 py-1 text-sm font-bold uppercase tracking-wide text-success';

function tagErrorMessage(err: unknown): string {
  return err instanceof ApiError && err.status === 409
    ? 'A tag with that name already exists.'
    : 'Could not save that tag. Please try again.';
}

// The managed tag list. Tags are Admin-only labels (e.g. "low-income") that
// members never see; members carry them by reference, so a rename here
// applies to everyone tagged.
export function MemberTagsSection({ tags, onChanged }: { tags: AdminTag[]; onChanged: () => void }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      showToast(success, 'success');
      onChanged();
      return true;
    } catch (err) {
      showToast(tagErrorMessage(err), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (await run(() => createAdminTag(token!, name), `Tag "${name}" created.`)) setNewName('');
  }

  async function handleRename(tag: AdminTag) {
    const name = editName.trim();
    if (!name) return;
    if (await run(() => renameAdminTag(token!, tag.id, name), `Renamed to "${name}".`)) setEditingId(null);
  }

  async function handleDelete(tag: AdminTag) {
    if (await run(() => deleteAdminTag(token!, tag.id), `Tag "${tag.name}" deleted.`)) setConfirmingDeleteId(null);
  }

  return (
    <section className="mb-10">
      <h2 className={SECTION_HEADING}>Member tags</h2>
      <p className="mb-4 text-sm font-medium text-text-secondary">
        Private labels for grouping members, e.g. "low-income". Members never see their tags.
      </p>

      <form onSubmit={handleCreate} className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <Input label="New tag" placeholder="e.g. low-income" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={busy || !newName.trim()}>
          Add tag
        </Button>
      </form>

      {tags.length === 0 && <p className="text-sm text-text-secondary">No tags yet.</p>}

      <div className="flex flex-col gap-2">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between gap-3 rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-3"
          >
            {editingId === tag.id ? (
              <>
                <input
                  aria-label={`Rename ${tag.name}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border-2 border-border px-2 py-1 text-sm"
                />
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" disabled={busy || !editName.trim()} onClick={() => handleRename(tag)}>
                    Save
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : confirmingDeleteId === tag.id ? (
              <>
                <p className="min-w-0 flex-1 text-sm font-bold text-text-body">
                  Remove "{tag.name}" from {tag.memberCount} member{tag.memberCount === 1 ? '' : 's'} and delete it?
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" disabled={busy} onClick={() => handleDelete(tag)}>
                    Delete
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmingDeleteId(null)}>
                    Keep
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="truncate font-bold text-text-heading">{tag.name}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                    {tag.memberCount} member{tag.memberCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditName(tag.name);
                      setEditingId(tag.id);
                    }}
                  >
                    Rename
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmingDeleteId(tag.id)}>
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
