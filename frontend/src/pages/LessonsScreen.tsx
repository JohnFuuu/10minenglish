import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import {
  ApiError,
  cancelLesson,
  fetchBuddySlots,
  fetchUserLessons,
  rescheduleLesson,
  type LessonWithBuddy,
} from '../lib/api';
import type { BookLessonPrefill } from './BookLesson';

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

export function LessonsScreen() {
  const { token, account, setCredits } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [upcoming, setUpcoming] = useState<LessonWithBuddy[]>([]);
  const [previous, setPrevious] = useState<LessonWithBuddy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        setUpcoming(res.upcoming);
        setPrevious(res.previous);
      })
      .catch(() => showToast('Could not load your lessons.', 'error'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setUpcoming((current) =>
        [...current.map((l) => (l.id === lesson.id ? { ...l, startTime: res.lesson.startTime } : l))].sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        ),
      );
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
      setUpcoming((current) => current.filter((l) => l.id !== lesson.id));
      setPrevious((current) => [{ ...lesson, status: res.lesson.status }, ...current]);
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

  const hasNoLessons = !isLoading && upcoming.length === 0 && previous.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-body">Lessons</h1>
        <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>

      {isLoading && <p className="text-text-secondary">Loading your lessons…</p>}
      {hasNoLessons && <p className="text-text-secondary">No lessons booked</p>}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Upcoming</h2>
          <div className="flex flex-col gap-3">
            {upcoming.map((lesson) => (
              <Card key={lesson.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-text-body">{lesson.buddyName}</p>
                    <p className="text-sm text-text-secondary">{formatDateTime(lesson.startTime)}</p>
                  </div>
                  <div className="flex gap-2">
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

      {previous.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Previous</h2>
          <div className="flex flex-col gap-3">
            {previous.map((lesson) => (
              <Card key={lesson.id} className="opacity-80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-text-body">{lesson.buddyName}</p>
                    <p className="text-sm text-text-secondary">{formatDateTime(lesson.startTime)}</p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                    {previousStatusLabel(lesson)}
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
    </main>
  );
}
