import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Button, Card } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { initialsOf } from '../lib/initials';
import { fetchBuddy, setBuddyFavourite, type BuddyDetail } from '../lib/api';
import type { BookLessonPrefill } from './BookLesson';

export function BuddyScreen() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [buddy, setBuddy] = useState<BuddyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    fetchBuddy(token, id)
      .then(setBuddy)
      .catch(() => showToast('Could not load this buddy.', 'error'))
      .finally(() => setIsLoading(false));
  }, [token, id, showToast]);

  async function toggleFavourite() {
    if (!token || !buddy) return;
    const next = !buddy.isFavourite;
    try {
      await setBuddyFavourite(token, buddy.id, next);
      setBuddy({ ...buddy, isFavourite: next });
      showToast(
        next
          ? `${buddy.name ?? 'Buddy'} added to your favourites.`
          : `${buddy.name ?? 'Buddy'} removed from your favourites.`,
        'success',
      );
    } catch {
      showToast('Could not update your favourites.', 'error');
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-body">Buddy</h1>
        <Button variant="secondary" size="sm" onClick={() => navigate('/buddies')}>
          Back to Buddies
        </Button>
      </div>

      {isLoading && <p className="text-text-secondary">Loading…</p>}

      {!isLoading && buddy && (
        <>
          <Card className="mb-6">
            <div className="mb-4 flex items-center gap-4">
              {buddy.picture ? (
                <img
                  src={buddy.picture}
                  alt={buddy.name}
                  className="h-14 w-14 shrink-0 rounded-full border-2 border-accent-lime object-cover"
                />
              ) : (
                <Avatar initials={initialsOf(buddy.name)} size={56} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-text-body">{buddy.name}</p>
                {buddy.location && (
                  <p className="truncate text-sm text-text-secondary">{buddy.location}</p>
                )}
              </div>
              <button
                type="button"
                aria-label={buddy.isFavourite ? 'Unfavourite' : 'Favourite'}
                onClick={toggleFavourite}
                className="shrink-0 px-2 text-2xl text-brand-primary"
              >
                {buddy.isFavourite ? '★' : '☆'}
              </button>
            </div>

            {buddy.bio && <p className="text-sm text-text-body">{buddy.bio}</p>}
          </Card>

          <Button
            size="md"
            tone="blue"
            className="w-full"
            disabled={!buddy.bookable}
            onClick={() =>
              navigate('/book', {
                state: { buddyId: buddy.id, buddyName: buddy.name } satisfies BookLessonPrefill,
              })
            }
          >
            Book this buddy
          </Button>

          {!buddy.bookable && (
            <p className="mt-2 text-center text-sm text-text-secondary">
              This buddy hasn't set up a Zoom link yet, so they can't be booked.
            </p>
          )}
        </>
      )}
    </main>
  );
}
