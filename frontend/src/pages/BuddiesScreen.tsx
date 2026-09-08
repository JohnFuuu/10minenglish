import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Card } from '../components';
import { useAuth } from '../auth/AuthContext';
import { initialsOf } from '../lib/initials';
import { useToast } from '../toast/ToastContext';
import {
  fetchBookableBuddies,
  fetchFavouriteBuddies,
  fetchRecentBuddies,
  setBuddyFavourite,
  type DirectoryBuddy,
} from '../lib/api';

type Tab = 'all' | 'recent' | 'favourite';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Recent' },
  { id: 'favourite', label: 'Favourite' },
];

const EMPTY_MESSAGE: Record<Tab, string> = {
  all: 'No buddies are bookable yet.',
  recent: "You haven't had a lesson with anyone yet.",
  favourite: 'No favourites yet — star a buddy to keep them here.',
};

export function BuddiesScreen() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('all');
  const [buddies, setBuddies] = useState<DirectoryBuddy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(
    async (which: Tab) => {
      if (!token) return;
      setIsLoading(true);
      try {
        const fetcher =
          which === 'all'
            ? fetchBookableBuddies
            : which === 'recent'
              ? fetchRecentBuddies
              : fetchFavouriteBuddies;
        const res = await fetcher(token);
        setBuddies(res.buddies);
      } catch {
        showToast('Could not load buddies.', 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [token, showToast],
  );

  useEffect(() => {
    load(tab);
  }, [load, tab]);

  async function toggleFavourite(buddy: DirectoryBuddy) {
    if (!token) return;
    const next = !buddy.isFavourite;
    try {
      await setBuddyFavourite(token, buddy.id, next);
      showToast(
        next
          ? `${buddy.name ?? 'Buddy'} added to your favourites.`
          : `${buddy.name ?? 'Buddy'} removed from your favourites.`,
        'success',
      );
      // The favourites tab is a list of exactly these, so a removal has to drop
      // the row rather than just flip its star.
      if (tab === 'favourite' && !next) {
        setBuddies((current) => current.filter((b) => b.id !== buddy.id));
      } else {
        setBuddies((current) =>
          current.map((b) => (b.id === buddy.id ? { ...b, isFavourite: next } : b)),
        );
      }
    } catch {
      showToast('Could not update your favourites.', 'error');
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-body">Buddies</h1>
        <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>

      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'rounded-md border-2 border-brand-primary bg-brand-primary px-4 py-2 text-sm font-bold text-text-inverse'
                : 'rounded-md border-2 border-border px-4 py-2 text-sm font-bold text-text-secondary'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-text-secondary">Loading buddies…</p>}

      {!isLoading && buddies.length === 0 && (
        <p className="text-text-secondary">{EMPTY_MESSAGE[tab]}</p>
      )}

      {!isLoading &&
        buddies.map((buddy) => (
          <Card key={buddy.id} className="mb-3 flex items-center gap-4">
            {buddy.picture ? (
              <img
                src={buddy.picture}
                alt={buddy.name}
                className="h-10 w-10 shrink-0 rounded-full border-2 border-accent-lime object-cover"
              />
            ) : (
              <Avatar initials={initialsOf(buddy.name)} />
            )}

            <button
              type="button"
              onClick={() => navigate(`/buddies/${buddy.id}`)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate font-bold text-text-body">{buddy.name}</p>
              {buddy.location && (
                <p className="truncate text-sm text-text-secondary">{buddy.location}</p>
              )}
            </button>

            <button
              type="button"
              aria-label={buddy.isFavourite ? 'Unfavourite' : 'Favourite'}
              onClick={() => toggleFavourite(buddy)}
              className="shrink-0 px-2 text-xl text-brand-primary"
            >
              {buddy.isFavourite ? '★' : '☆'}
            </button>
          </Card>
        ))}
    </main>
  );
}
