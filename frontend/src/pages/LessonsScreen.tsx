import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarX, Video } from 'lucide-react';
import { Avatar, BottomNav, Button, Card, Input, NAV_CLEARANCE_CLASS } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import {
  ApiError,
  cancelLesson,
  fetchBuddySlots,
  fetchNotifications,
  fetchUserLessons,
  rescheduleLesson,
  type LessonWithBuddy,
} from '../lib/api';
import type { BookLessonPrefill } from './BookLesson';
import { formatDateTime } from '../lib/formatDateTime';
import { initialsOf } from '../lib/initials';
import { readSessionCache, writeSessionCache } from '../lib/sessionCache';

const LESSONS_CACHE_KEY = '10me.cache.lessons';

// Mirrors the backend's CANCELLATION_REFUND_CUTOFF_HOURS (lessonBooking.ts),
// which both the cancellation-refund rule and the reschedule rule read from
// (see docs/adr/0005) — update both places together if this ever changes.
const REFUND_CUTOFF_HOURS = 12;

// Mirrors the backend's join window (JOIN_WINDOW_MINUTES_BEFORE in
// lessonBooking.ts): joinable from 10 minutes before start through the
// lesson's end.
const JOIN_WINDOW_MINUTES_BEFORE = 10;

// How often we recompute joinability client-side, so "Join lesson" appears
// without requiring a page reload.
const JOINABLE_RECHECK_INTERVAL_MS = 30_000;

const ZOOM_LINK_PATTERN = /^https:\/\//;

// Matches the backend's reschedule rule: a Lesson can only be moved while it is
// still outside the same window that governs cancellation refunds.
const RESCHEDULE_CUTOFF_HOURS = REFUND_CUTOFF_HOURS;

const RESCHEDULE_DAY_OPTIONS = 14;

const VIEWER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}


function timeOfDayValue(iso: string): string {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000);
}

function previousStatusLabel(lesson: LessonWithBuddy): string {
  if (lesson.status === 'cancelled') return 'Cancelled';
  if (lesson.status === 'completed') return 'Completed';
  return 'Past';
}

const PREVIOUS_STATUS_STYLE: Record<string, string> = {
  Cancelled: 'bg-error/10 text-error',
  Completed: 'bg-accent-lime-light text-brand-secondary',
  Past: 'bg-border text-text-secondary',
};

type LessonsCache = { upcoming: LessonWithBuddy[]; previous: LessonWithBuddy[] };

// Module-level cache (not React state), seeded from sessionStorage, so
// re-entering this screen — via BottomNav or a hard page reload — shows the
// last known lessons immediately instead of flashing "Loading your
// lessons…". Refetched silently in the background.
let lessonsCache: LessonsCache | null = readSessionCache<LessonsCache>(LESSONS_CACHE_KEY);
function setLessonsCache(next: LessonsCache) {
  lessonsCache = next;
  writeSessionCache(LESSONS_CACHE_KEY, next);
}

export function LessonsScreen() {
  const { token, account, setCredits } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'upcoming' | 'previous'>('upcoming');
  const [upcoming, setUpcoming] = useState<LessonWithBuddy[]>(lessonsCache?.upcoming ?? []);
  const [previous, setPrevious] = useState<LessonWithBuddy[]>(lessonsCache?.previous ?? []);
  const [isLoading, setIsLoading] = useState(lessonsCache === null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<string[] | null>(null);
  const [savingRescheduleId, setSavingRescheduleId] = useState<string | null>(null);
  // null until the first tick fires — before that we fall back to the
  // server-computed `joinable` snapshot from the initial fetch.
  const [tickNow, setTickNow] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchUserLessons(token)
      .then((res) => {
        setLessonsCache({ upcoming: res.upcoming, previous: res.previous });
        setUpcoming(res.upcoming);
        setPrevious(res.previous);
      })
      .catch(() => showToast('Could not load your lessons.', 'error'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
  }, [token]);

  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), JOINABLE_RECHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (!token || !account) return null;

  function isJoinable(lesson: LessonWithBuddy): boolean {
    if (tickNow === null) return lesson.joinable;
    const start = new Date(lesson.startTime).getTime();
    const windowStart = start - JOIN_WINDOW_MINUTES_BEFORE * 60_000;
    const windowEnd = start + lesson.durationMinutes * 60_000;
    return tickNow >= windowStart && tickNow <= windowEnd;
  }

  function openReschedule(lesson: LessonWithBuddy) {
    if (reschedulingId === lesson.id) {
      setReschedulingId(null);
      return;
    }
    setConfirmingId(null);
    setReschedulingId(lesson.id);
    setRescheduleSlots(null);
    setRescheduleDate('');
  }

  async function loadSlots(lesson: LessonWithBuddy, date: string) {
    setRescheduleDate(date);
    setRescheduleSlots(null);
    if (!date) return;
    try {
      const res = await fetchBuddySlots(token!, lesson.buddyId, date, VIEWER_TIMEZONE);
      // The Lesson's own slot is still booked, so it comes back excluded — the
      // list is the times it can actually move to.
      setRescheduleSlots(res.slots);
    } catch {
      showToast('Could not load available times.', 'error');
      setRescheduleSlots([]);
    }
  }

  async function handleReschedule(lesson: LessonWithBuddy, startTime: string) {
    setSavingRescheduleId(lesson.id);
    try {
      const res = await rescheduleLesson(token!, lesson.id, startTime);
      setUpcoming((current) => {
        const next = [
          ...current.map((l) => (l.id === lesson.id ? { ...l, startTime: res.lesson.startTime } : l)),
        ].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        if (lessonsCache) setLessonsCache({ ...lessonsCache, upcoming: next });
        return next;
      });
      setReschedulingId(null);
      showToast('Lesson moved. Your buddy has been notified.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not move this lesson.', 'error');
    } finally {
      setSavingRescheduleId(null);
    }
  }

  async function handleCancel(lesson: LessonWithBuddy) {
    setCancellingId(lesson.id);
    try {
      const res = await cancelLesson(token!, lesson.id);
      setUpcoming((current) => {
        const next = current.filter((l) => l.id !== lesson.id);
        if (lessonsCache) setLessonsCache({ ...lessonsCache, upcoming: next });
        return next;
      });
      setPrevious((current) => {
        const next = [{ ...lesson, status: res.lesson.status }, ...current];
        if (lessonsCache) setLessonsCache({ ...lessonsCache, previous: next });
        return next;
      });
      setCredits(res.creditsRemaining);
      setConfirmingId(null);
      showToast(
        res.refunded ? 'Lesson cancelled and your credit was refunded.' : 'Lesson cancelled — no refund for this late cancellation.',
        'success',
      );
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not cancel this lesson.', 'error');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className={`mx-auto max-w-3xl ${NAV_CLEARANCE_CLASS}`}>
      <div className="px-5 pb-2 pt-8">
        <h1 className="font-display text-2xl font-black text-text-heading">My Lessons</h1>
      </div>

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
          <p className="mb-1 text-sm font-bold uppercase tracking-widest text-text-heading">No upcoming lessons</p>
          <p className="mb-5 text-sm text-text-secondary">Book a session with a Buddy.</p>
          <Button onClick={() => navigate('/buddies')}>Browse buddies</Button>
        </div>
      )}

      {!isLoading && tab === 'previous' && previous.length === 0 && (
        <div className="px-5 py-16 text-center">
          <CalendarX size={40} className="mx-auto mb-3 text-text-secondary" />
          <p className="text-sm font-bold uppercase tracking-widest text-text-heading">No past lessons</p>
          <p className="text-sm text-text-secondary">Completed lessons appear here.</p>
        </div>
      )}

      {tab === 'upcoming' && upcoming.length > 0 && (
        <section className="px-5">
          <div className="flex flex-col gap-3">
            {upcoming.map((lesson) => (
              <Card key={lesson.id}>
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={initialsOf(lesson.buddyName)} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-text-heading">{lesson.buddyName}</p>
                      <p className="text-sm text-text-secondary">{formatDateTime(lesson.startTime)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-success-bg px-2.5 py-1 text-xs font-bold tracking-widest text-success">
                    UPCOMING
                  </span>
                </div>

                {ZOOM_LINK_PATTERN.test(lesson.zoomLink) && (
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

                <div className="mt-3 flex gap-2">
                    {isJoinable(lesson) && ZOOM_LINK_PATTERN.test(lesson.zoomLink) && (
                      <Button size="sm" tone="blue" onClick={() => window.open(lesson.zoomLink, '_blank', 'noopener')}>
                        Join lesson
                      </Button>
                    )}
                    {hoursUntil(lesson.startTime) >= RESCHEDULE_CUTOFF_HOURS && (
                      <Button variant="secondary" size="sm" onClick={() => openReschedule(lesson)}>
                        Reschedule
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setReschedulingId(null);
                        setConfirmingId(confirmingId === lesson.id ? null : lesson.id);
                      }}
                    >
                      Cancel
                    </Button>
                </div>

                {confirmingId === lesson.id && (
                  <div
                    className={
                      hoursUntil(lesson.startTime) < REFUND_CUTOFF_HOURS
                        ? 'mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs font-bold text-warning'
                        : 'mt-3 rounded-md bg-success/10 px-3 py-2 text-xs font-bold text-success'
                    }
                  >
                    {hoursUntil(lesson.startTime) < REFUND_CUTOFF_HOURS
                      ? "Cancelling now won't refund your credit."
                      : 'This will cancel your lesson and refund 1 credit.'}
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

                {reschedulingId === lesson.id && (
                  <div className="mt-3 rounded-md border-2 border-border p-3">
                    <label
                      className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary"
                      htmlFor={`reschedule-date-${lesson.id}`}
                    >
                      Move to another time with {lesson.buddyName}
                    </label>
                    <Input
                      id={`reschedule-date-${lesson.id}`}
                      type="date"
                      min={toLocalDateString(new Date())}
                      max={toLocalDateString(
                        new Date(Date.now() + RESCHEDULE_DAY_OPTIONS * 24 * 60 * 60 * 1000),
                      )}
                      value={rescheduleDate}
                      onChange={(e) => loadSlots(lesson, e.target.value)}
                    />

                    {rescheduleDate && rescheduleSlots === null && (
                      <p className="mt-2 text-sm text-text-secondary">Loading times…</p>
                    )}
                    {rescheduleSlots?.length === 0 && (
                      <p className="mt-2 text-sm text-text-secondary">
                        No free times that day — try another date.
                      </p>
                    )}
                    {rescheduleSlots && rescheduleSlots.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rescheduleSlots.map((slot) => (
                          <Button
                            key={slot}
                            variant="secondary"
                            size="sm"
                            disabled={savingRescheduleId === lesson.id}
                            onClick={() => handleReschedule(lesson, slot)}
                          >
                            {formatSlotTime(slot)}
                          </Button>
                        ))}
                      </div>
                    )}
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
                    <Avatar initials={initialsOf(lesson.buddyName)} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-text-heading">{lesson.buddyName}</p>
                      <p className="text-sm text-text-secondary">{formatDateTime(lesson.startTime)}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold tracking-widest ${PREVIOUS_STATUS_STYLE[previousStatusLabel(lesson)]}`}
                  >
                    {previousStatusLabel(lesson).toUpperCase()}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      navigate('/book', {
                        state: { timeOfDay: timeOfDayValue(lesson.startTime) } satisfies BookLessonPrefill,
                      })
                    }
                  >
                    Book this time again
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      navigate('/book', {
                        state: { buddyId: lesson.buddyId, buddyName: lesson.buddyName } satisfies BookLessonPrefill,
                      })
                    }
                  >
                    Book this buddy again
                  </Button>
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
