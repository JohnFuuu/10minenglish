import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Button, Input } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import {
  ApiError,
  bookLesson,
  bookRecurringLessons,
  fetchAvailableBuddies,
  fetchBookableBuddies,
  fetchBuddySlots,
  type BookableBuddy,
  type Lesson,
  type RecurringFrequency,
} from '../lib/api';

type Step = 'entry' | 'buddy-pick' | 'buddy-day' | 'buddy-time' | 'time-pick' | 'time-buddy' | 'options' | 'confirm' | 'success';
type FrequencyType = 'daily' | 'weekly' | 'everyXDays';

interface SingleResult {
  kind: 'single';
  lesson: Lesson;
}

interface RecurringResult {
  kind: 'recurring';
  booked: Lesson[];
  skipped: { startTime: string; reason: string }[];
}

export interface BookLessonPrefill {
  buddyId?: string;
  buddyName?: string;
  timeOfDay?: string;
}

const VIEWER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextDays(count: number): Date[] {
  const days: Date[] = [];
  for (let i = 1; i <= count; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function buddyLabel(buddy: BookableBuddy | null): string {
  return buddy?.name ?? 'Buddy';
}

function buddyInitials(buddy: BookableBuddy | null): string {
  const name = buddy?.name ?? 'B';
  return name.slice(0, 1).toUpperCase();
}

export function BookLesson() {
  const { account, token, setCredits } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<Step>('entry');

  const [buddies, setBuddies] = useState<BookableBuddy[]>([]);
  const [selectedBuddy, setSelectedBuddy] = useState<BookableBuddy | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [daySlots, setDaySlots] = useState<string[]>([]);
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);

  const [timeInput, setTimeInput] = useState('10:00');
  const [timeBuddies, setTimeBuddies] = useState<BookableBuddy[]>([]);

  const [bookingType, setBookingType] = useState<'single' | 'recurring'>('single');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('weekly');
  const [everyXDays, setEveryXDays] = useState(2);
  const [includeWeekends, setIncludeWeekends] = useState(true);
  const [occurrenceCount, setOccurrenceCount] = useState(4);
  const [recurringBuddyMode, setRecurringBuddyMode] = useState<'fixed' | 'any'>('fixed');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SingleResult | RecurringResult | null>(null);

  useEffect(() => {
    if (account && account.credits < 1) {
      showToast('Buy credits to book a lesson.', 'error');
      navigate('/credits');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  useEffect(() => {
    const prefill = location.state as BookLessonPrefill | null;
    if (!prefill) return;
    if (prefill.buddyId) {
      pickBuddy({ id: prefill.buddyId, name: prefill.buddyName });
    } else if (prefill.timeOfDay) {
      setSelectedDate(toLocalDateString(nextDays(1)[0]));
      setTimeInput(prefill.timeOfDay);
      setStep('time-pick');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!token || !account || account.credits < 1) return null;

  async function startByBuddy() {
    setIsLoading(true);
    try {
      const res = await fetchBookableBuddies(token!);
      setBuddies(res.buddies);
      setStep('buddy-pick');
    } catch {
      showToast('Could not load Buddies. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  function startByTime() {
    setSelectedDate(toLocalDateString(nextDays(1)[0]));
    setStep('time-pick');
  }

  function pickBuddy(buddy: BookableBuddy) {
    setSelectedBuddy(buddy);
    setSelectedDate(toLocalDateString(nextDays(1)[0]));
    setStep('buddy-day');
  }

  async function pickDay(date: string) {
    setSelectedDate(date);
    setIsLoading(true);
    try {
      const res = await fetchBuddySlots(token!, selectedBuddy!.id, date, VIEWER_TIMEZONE);
      setDaySlots(res.slots);
      setStep('buddy-time');
    } catch {
      showToast('Could not load available times. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  function pickBuddyTimeSlot(iso: string) {
    setSelectedStartTime(iso);
    setStep('options');
  }

  async function findTeachersAtTime() {
    const startTime = new Date(`${selectedDate}T${timeInput}:00`);
    if (Number.isNaN(startTime.getTime())) {
      showToast('Please choose a valid date and time.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetchAvailableBuddies(token!, startTime.toISOString());
      setSelectedStartTime(startTime.toISOString());
      setTimeBuddies(res.buddies);
      setStep('time-buddy');
    } catch {
      showToast('Could not check availability. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  function pickTimeBuddy(buddy: BookableBuddy) {
    setSelectedBuddy(buddy);
    setStep('options');
  }

  function frequencyPayload(): RecurringFrequency {
    if (frequencyType === 'everyXDays') return { type: 'everyXDays', days: Math.max(1, everyXDays) };
    return { type: frequencyType };
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      if (bookingType === 'single') {
        const res = await bookLesson(token!, selectedBuddy!.id, selectedStartTime!);
        setCredits(res.creditsRemaining);
        setResult({ kind: 'single', lesson: res.lesson });
      } else {
        const res = await bookRecurringLessons(token!, {
          buddyId: recurringBuddyMode === 'fixed' ? selectedBuddy!.id : undefined,
          startTime: selectedStartTime!,
          frequency: frequencyPayload(),
          includeWeekends,
          occurrenceCount,
          timezone: VIEWER_TIMEZONE,
        });
        setCredits(res.creditsRemaining);
        setResult({ kind: 'recurring', booked: res.booked, skipped: res.skipped });
      }
      setStep('success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong booking your lesson.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-body">Book a Lesson</h1>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="text-xs font-bold uppercase tracking-wide text-text-secondary"
        >
          Cancel
        </button>
      </div>

      {isLoading && <p className="text-sm font-bold text-text-secondary">Loading…</p>}

      {!isLoading && step === 'entry' && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={startByBuddy}
            className="rounded-md border-2 border-b-[4px] border-brand-primary-border bg-brand-primary p-4 text-left font-bold text-text-inverse"
          >
            Book by Buddy
            <p className="mt-1 text-xs font-medium text-accent-lime-light">Choose who you want to practise with first</p>
          </button>
          <button
            type="button"
            onClick={startByTime}
            className="rounded-md border-2 border-b-[4px] border-brand-secondary-border bg-brand-secondary p-4 text-left font-bold text-text-inverse"
          >
            Book by Time
            <p className="mt-1 text-xs font-medium text-white/80">Choose when, then pick from who's free</p>
          </button>
        </div>
      )}

      {!isLoading && step === 'buddy-pick' && (
        <div className="flex flex-col gap-2">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-secondary">Choose a Buddy</h2>
          {buddies.length === 0 && <p className="text-sm text-text-secondary">No Buddies are bookable right now.</p>}
          {buddies.map((buddy) => (
            <button
              key={buddy.id}
              type="button"
              onClick={() => pickBuddy(buddy)}
              className="flex items-center gap-3 rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-3 text-left"
            >
              <Avatar initials={buddyInitials(buddy)} />
              <div>
                <p className="font-bold text-text-heading">{buddyLabel(buddy)}</p>
                {buddy.bio && <p className="text-xs text-text-secondary line-clamp-1">{buddy.bio}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {!isLoading && step === 'buddy-day' && (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Choose a day</h2>
          <div className="grid grid-cols-2 gap-2">
            {nextDays(14).map((d) => {
              const value = toLocalDateString(d);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pickDay(value)}
                  className="rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-3 text-sm font-bold text-text-heading"
                >
                  {d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setStep('buddy-pick')} className="mt-4 text-sm font-bold text-brand-secondary">
            ← Back
          </button>
        </div>
      )}

      {!isLoading && step === 'buddy-time' && (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Choose a time</h2>
          {daySlots.length === 0 && <p className="mb-4 text-sm text-text-secondary">No times available this day — try another day.</p>}
          <div className="grid grid-cols-3 gap-2">
            {daySlots.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => pickBuddyTimeSlot(iso)}
                className="rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-3 text-sm font-bold text-text-heading"
              >
                {formatTime(iso)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep('buddy-day')} className="mt-4 text-sm font-bold text-brand-secondary">
            ← Back
          </button>
        </div>
      )}

      {step === 'time-pick' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Choose a day and time</h2>
          <Input type="date" value={selectedDate} min={toLocalDateString(nextDays(1)[0])} onChange={(e) => setSelectedDate(e.target.value)} />
          <Input type="time" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} />
          <Button onClick={findTeachersAtTime} disabled={isLoading}>
            Find Buddies
          </Button>
        </div>
      )}

      {!isLoading && step === 'time-buddy' && (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">
            Available at {selectedStartTime && formatDateTime(selectedStartTime)}
          </h2>
          {timeBuddies.length === 0 && (
            <p className="mb-4 text-sm text-text-secondary">No teachers free at this time — choose a different time.</p>
          )}
          <div className="flex flex-col gap-2">
            {timeBuddies.map((buddy) => (
              <button
                key={buddy.id}
                type="button"
                onClick={() => pickTimeBuddy(buddy)}
                className="flex items-center gap-3 rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-3 text-left"
              >
                <Avatar initials={buddyInitials(buddy)} />
                <p className="font-bold text-text-heading">{buddyLabel(buddy)}</p>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep('time-pick')} className="mt-4 text-sm font-bold text-brand-secondary">
            ← Choose a different time
          </button>
        </div>
      )}

      {step === 'options' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Booking type</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBookingType('single')}
              className={
                bookingType === 'single'
                  ? 'flex-1 rounded-md border-2 border-b-[4px] border-brand-primary-border bg-brand-primary p-3 text-sm font-bold text-text-inverse'
                  : 'flex-1 rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-3 text-sm font-bold text-text-heading'
              }
            >
              Single lesson
            </button>
            <button
              type="button"
              onClick={() => setBookingType('recurring')}
              className={
                bookingType === 'recurring'
                  ? 'flex-1 rounded-md border-2 border-b-[4px] border-brand-primary-border bg-brand-primary p-3 text-sm font-bold text-text-inverse'
                  : 'flex-1 rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-3 text-sm font-bold text-text-heading'
              }
            >
              Recurring
            </button>
          </div>

          {bookingType === 'recurring' && (
            <div className="rounded-md border-2 border-accent-lime bg-accent-lime-light p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-success">Repeat pattern</p>
              <div className="mb-3 flex gap-2">
                {(['daily', 'weekly', 'everyXDays'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequencyType(f)}
                    className={
                      frequencyType === f
                        ? 'rounded-md border-2 border-b-[3px] border-brand-primary-border bg-brand-primary px-3 py-2 text-xs font-bold uppercase text-text-inverse'
                        : 'rounded-md border-2 border-b-[3px] border-accent-lime bg-bg-surface px-3 py-2 text-xs font-bold uppercase text-success'
                    }
                  >
                    {f === 'daily' ? 'Daily' : f === 'weekly' ? 'Weekly' : 'Every X days'}
                  </button>
                ))}
              </div>

              {frequencyType === 'everyXDays' && (
                <label className="mb-3 flex items-center gap-2 text-sm font-bold text-text-heading">
                  Every
                  <Input
                    type="number"
                    min={1}
                    value={everyXDays}
                    onChange={(e) => setEveryXDays(Number(e.target.value))}
                    className="w-16 text-center"
                  />
                  days
                </label>
              )}

              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-text-heading">
                <input type="checkbox" checked={includeWeekends} onChange={(e) => setIncludeWeekends(e.target.checked)} />
                Include weekends
              </label>

              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-text-heading">
                Number of sessions
                <Input
                  type="number"
                  min={1}
                  max={account.credits}
                  value={occurrenceCount}
                  onChange={(e) => setOccurrenceCount(Number(e.target.value))}
                  className="w-16 text-center"
                />
              </label>

              {selectedBuddy && (
                <label className="flex items-center gap-2 text-sm font-bold text-text-heading">
                  <input
                    type="checkbox"
                    checked={recurringBuddyMode === 'fixed'}
                    onChange={(e) => setRecurringBuddyMode(e.target.checked ? 'fixed' : 'any')}
                  />
                  Always with {buddyLabel(selectedBuddy)}
                </label>
              )}

              <p className="mt-3 text-xs font-medium text-success">
                Credits deducted only for successfully booked sessions. Unfillable slots are skipped and reported.
              </p>
            </div>
          )}

          <Button onClick={() => setStep('confirm')}>Continue</Button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Confirm booking</h2>
          <div className="overflow-hidden rounded-md border-2 border-b-[4px] border-border">
            {[
              { label: 'Buddy', value: recurringBuddyMode === 'any' ? 'First available' : buddyLabel(selectedBuddy) },
              { label: 'Time', value: selectedStartTime ? formatDateTime(selectedStartTime) : '' },
              { label: 'Type', value: bookingType === 'recurring' ? `Recurring (${frequencyType})` : 'Single lesson' },
              { label: 'Credits', value: bookingType === 'single' ? '1 credit' : `Up to ${occurrenceCount} credits` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-t border-border bg-bg-surface px-4 py-3 first:border-t-0">
                <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">{row.label}</span>
                <span className="text-sm font-bold text-text-heading">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-md border-2 border-accent-lime bg-accent-lime-light p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-success">Balance after booking</p>
            <p className="mt-0.5 text-base font-bold text-text-heading">
              {account.credits - (bookingType === 'single' ? 1 : occurrenceCount)} credits remaining (worst case)
            </p>
          </div>

          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Confirming…' : 'Confirm & book'}
          </Button>
          <button type="button" onClick={() => setStep('options')} className="text-center text-sm font-bold text-text-secondary">
            Back
          </button>
        </div>
      )}

      {step === 'success' && result && (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-4xl">🎉</p>
          <h2 className="font-display text-2xl font-black text-brand-primary">Booked!</h2>

          {result.kind === 'single' && (
            <p className="text-sm font-bold text-text-secondary">{formatDateTime(result.lesson.startTime)}</p>
          )}

          {result.kind === 'recurring' && (
            <div className="text-left">
              <p className="mb-2 text-sm font-bold text-text-heading">{result.booked.length} session(s) booked:</p>
              <ul className="mb-3 flex flex-col gap-1">
                {result.booked.map((lesson) => (
                  <li key={lesson.id} className="rounded-md bg-accent-lime-light px-3 py-2 text-sm font-bold text-success">
                    {formatDateTime(lesson.startTime)}
                  </li>
                ))}
              </ul>
              {result.skipped.length > 0 && (
                <>
                  <p className="mb-2 text-sm font-bold text-text-heading">{result.skipped.length} session(s) skipped:</p>
                  <ul className="flex flex-col gap-1">
                    {result.skipped.map((s) => (
                      <li key={s.startTime} className="rounded-md bg-warning/10 px-3 py-2 text-xs font-bold text-warning">
                        {formatDateTime(s.startTime)} — {s.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-3 text-xs font-medium text-text-secondary">
                You can edit or cancel individual sessions later from your Dashboard.
              </p>
            </div>
          )}

          <p className="text-xs font-medium text-text-secondary">Confirmation email sent with your Zoom link.</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      )}
    </main>
  );
}
