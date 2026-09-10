import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, BottomNav, Button, NAV_CLEARANCE_CLASS } from '../components';
import { useAuth } from '../auth/AuthContext';
import { initialsOf } from '../lib/initials';
import { useToast } from '../toast/ToastContext';
import {
  fetchBookableBuddies,
  fetchFavouriteBuddies,
  fetchNotifications,
  fetchRecentBuddies,
  setBuddyFavourite,
  type DirectoryBuddy,
} from '../lib/api';
import type { BookLessonPrefill } from './BookLesson';

type Tab = 'all' | 'recent' | 'favourite';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'recent', label: 'RECENT' },
  { id: 'favourite', label: '♥ FAV' },
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
  const [search, setSearch] = useState('');
  const [buddies, setBuddies] = useState<DirectoryBuddy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

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

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buddies;
    return buddies.filter(
      (b) => b.name?.toLowerCase().includes(q) || b.location?.toLowerCase().includes(q),
    );
  }, [buddies, search]);

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

  function bookBuddy(buddy: DirectoryBuddy) {
    navigate('/book', { state: { buddyId: buddy.id, buddyName: buddy.name } satisfies BookLessonPrefill });
  }

  return (
    <main className={`mx-auto max-w-3xl ${NAV_CLEARANCE_CLASS}`}>
      <div className="px-5 pb-2 pt-8">
        <h1 className="font-display text-2xl font-black text-text-heading">Buddies</h1>
      </div>

      <div className="mb-4 px-5">
        <div className="flex items-center gap-2 rounded-md border-2 border-b-[3px] border-border bg-bg-surface px-4 py-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#777777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or location…"
            className="flex-1 bg-transparent text-sm font-medium text-text-body outline-none placeholder:text-text-secondary"
          />
        </div>
      </div>

      <div className="mb-5 flex gap-2 px-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'rounded-md border-2 border-b-[3px] border-brand-primary-border bg-brand-primary px-4 py-2 text-xs font-bold tracking-widest text-text-inverse'
                : 'rounded-md border-2 border-b-[3px] border-border bg-bg-surface px-4 py-2 text-xs font-bold tracking-widest text-text-secondary'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 px-5">
        {isLoading && <p className="text-text-secondary">Loading buddies…</p>}

        {!isLoading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="mb-3 text-4xl">🦉</p>
            <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              {buddies.length === 0 ? EMPTY_MESSAGE[tab] : 'No buddies match your search.'}
            </p>
          </div>
        )}

        {!isLoading &&
          filtered.map((buddy) => (
            <div key={buddy.id} className="rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-4">
              <div className="mb-3 flex items-start gap-3">
                {buddy.picture ? (
                  <img
                    src={buddy.picture}
                    alt={buddy.name}
                    className="h-14 w-14 shrink-0 rounded-xl border-2 border-border object-cover"
                  />
                ) : (
                  <Avatar initials={initialsOf(buddy.name)} size={56} />
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/buddies/${buddy.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-bold text-text-heading">{buddy.name}</p>
                  {buddy.location && <p className="truncate text-sm text-text-secondary">{buddy.location}</p>}
                </button>
                <button
                  type="button"
                  aria-label={buddy.isFavourite ? 'Unfavourite' : 'Favourite'}
                  onClick={() => toggleFavourite(buddy)}
                  className="shrink-0 p-1"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={buddy.isFavourite ? '#ff4b4b' : 'none'}
                    stroke={buddy.isFavourite ? '#ff4b4b' : '#777777'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>

              {buddy.bio && (
                <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-text-body">{buddy.bio}</p>
              )}

              <Button className="w-full" onClick={() => bookBuddy(buddy)}>
                Book with {(buddy.name ?? 'buddy').split(' ')[0]}
              </Button>
            </div>
          ))}
      </div>

      <BottomNav unreadCount={unreadCount} />
    </main>
  );
}
