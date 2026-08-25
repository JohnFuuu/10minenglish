import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { ApiError, cancelLesson, fetchUserLessons, type LessonWithBuddy } from '../lib/api';

const REFUND_CUTOFF_HOURS = 12;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

  if (!token || !account) return null;

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
                    {lesson.joinable && (
                      <Button size="sm" tone="blue" onClick={() => window.open(lesson.zoomLink, '_blank', 'noopener')}>
                        Join lesson
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmingId(confirmingId === lesson.id ? null : lesson.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>

                {confirmingId === lesson.id && (
                  <div className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs font-bold text-warning">
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
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
