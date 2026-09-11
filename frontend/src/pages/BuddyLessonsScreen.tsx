import { useState } from 'react';
import { CalendarX, Video } from 'lucide-react';
import { Avatar, BottomNav, Button, Card, NAV_CLEARANCE_CLASS, PageHeader } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { ApiError, buddyCancelLesson, fetchTeachingLessons, type LessonWithUser } from '../lib/api';
import { formatDateTime } from '../lib/formatDateTime';
import { initialsOf } from '../lib/initials';
import { useCachedFetch } from '../lib/useCachedFetch';
import { useUnreadCount } from '../lib/useUnreadCount';

const TEACHING_LESSONS_CACHE_KEY = '10me.cache.teachingLessons';

function previousStatusLabel(lesson: LessonWithUser): string {
  return lesson.status === 'cancelled' ? 'Cancelled' : 'Taught';
}

const PREVIOUS_STATUS_STYLE: Record<string, string> = {
  Cancelled: 'bg-error/10 text-error',
  Taught: 'bg-accent-lime-light text-brand-secondary',
};

type TeachingLessonsCache = { upcoming: LessonWithUser[]; previous: LessonWithUser[] };

export function BuddyLessonsScreen() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'upcoming' | 'previous'>('upcoming');
  const [lessons, setLessons, isLoading] = useCachedFetch<TeachingLessonsCache>(
    TEACHING_LESSONS_CACHE_KEY,
    () => fetchTeachingLessons(token!),
    [token],
    { enabled: Boolean(token), onError: () => showToast('Could not load your lessons.', 'error') },
  );
  const upcoming = lessons?.upcoming ?? [];
  const previous = lessons?.previous ?? [];
  const unreadCount = useUnreadCount(token);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function handleCancel(lesson: LessonWithUser) {
    setCancellingId(lesson.id);
    try {
      await buddyCancelLesson(token!, lesson.id);
      setLessons((current) => {
        if (!current) return current;
        return {
          upcoming: current.upcoming.filter((l) => l.id !== lesson.id),
          previous: [{ ...lesson, status: 'cancelled' as const }, ...current.previous],
        };
      });
      setConfirmingId(null);
      showToast("Lesson cancelled — the User's credit was refunded.", 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not cancel this lesson.', 'error');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className={`mx-auto max-w-3xl ${NAV_CLEARANCE_CLASS}`}>
      <PageHeader title="Teaching" />

      <div className="mb-5 flex gap-3 px-5 pt-4">
        {(['upcoming', 'previous'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'flex-1 rounded-md border-2 border-b-4 border-brand-primary-border bg-brand-primary py-3 text-xs font-bold tracking-widest text-text-inverse'
                : 'flex-1 rounded-md border-2 border-b-4 border-border bg-bg-surface py-3 text-xs font-bold tracking-widest text-text-secondary'
            }
          >
            {t === 'upcoming' ? `UPCOMING (${upcoming.length})` : 'PREVIOUS'}
          </button>
        ))}
      </div>

      {isLoading && <p className="px-5 text-text-secondary">Loading your lessons…</p>}

      {!isLoading && tab === 'upcoming' && upcoming.length === 0 && (
        <div className="px-5 py-16 text-center">
          <CalendarX size={40} className="mx-auto mb-3 text-text-secondary" />
          <p className="text-sm font-bold uppercase tracking-widest text-text-heading">No upcoming lessons</p>
          <p className="text-sm text-text-secondary">Lessons Users book with you will show up here.</p>
        </div>
      )}

      {!isLoading && tab === 'previous' && previous.length === 0 && (
        <div className="px-5 py-16 text-center">
          <CalendarX size={40} className="mx-auto mb-3 text-text-secondary" />
          <p className="text-sm font-bold uppercase tracking-widest text-text-heading">No past lessons</p>
          <p className="text-sm text-text-secondary">Lessons you've taught appear here.</p>
        </div>
      )}

      {tab === 'upcoming' && upcoming.length > 0 && (
        <section className="px-5">
          <div className="flex flex-col gap-3">
            {upcoming.map((lesson) => (
              <Card key={lesson.id}>
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={initialsOf(lesson.userName)} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-text-heading">{lesson.userName}</p>
                      <p className="text-sm text-text-secondary">{formatDateTime(lesson.startTime)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-success-bg px-2.5 py-1 text-xs font-bold tracking-widest text-success">
                    UPCOMING
                  </span>
                </div>

                {lesson.zoomLink?.startsWith('https://') && (
                  <a
                    href={lesson.zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1.5 text-xs font-bold text-brand-secondary"
                  >
                    <Video size={14} />
                    Zoom link
                  </a>
                )}

                <div className="mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmingId(confirmingId === lesson.id ? null : lesson.id)}
                  >
                    Cancel
                  </Button>
                </div>

                {confirmingId === lesson.id && (
                  <div className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs font-bold text-warning">
                    This will cancel the lesson and refund the User's credit, regardless of how soon it starts.
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        tone="blue"
                        disabled={cancellingId === lesson.id}
                        onClick={() => handleCancel(lesson)}
                      >
                        Confirm cancellation
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setConfirmingId(null)}>
                        Keep lesson
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {tab === 'previous' && previous.length > 0 && (
        <section className="px-5">
          <div className="flex flex-col gap-3">
            {previous.map((lesson) => (
              <Card key={lesson.id}>
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={initialsOf(lesson.userName)} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-text-heading">{lesson.userName}</p>
                      <p className="text-sm text-text-secondary">{formatDateTime(lesson.startTime)}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold tracking-widest ${PREVIOUS_STATUS_STYLE[previousStatusLabel(lesson)]}`}
                  >
                    {previousStatusLabel(lesson).toUpperCase()}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <BottomNav unreadCount={unreadCount} />
    </main>
  );
}
