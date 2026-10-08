import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, Info, PartyPopper, Repeat } from 'lucide-react';
import { Avatar, Button, Input } from '../components';
import { useAuth } from '../auth/AuthContext';
import { EmailConfirmationNotice } from '../auth/EmailConfirmationNotice';
import { LessonCalendarPreview } from './LessonCalendarPreview';
import { creditsLabel, useLessonPrice } from '../lib/useLessonPrice';
import { useToast } from '../toast/ToastContext';
import {
  ApiError,
  bookLesson,
  bookRecurringLessons,
  previewRecurringLessons,
  fetchAvailableBuddies,
  fetchBookableBuddies,
  fetchBuddySlots,
  type BookableBuddy,
  type Lesson,
  type RecurringFrequency,
} from '../lib/api';
import { formatDateTime } from '../lib/formatDateTime';

type Step = 'entry' | 'buddy-pick' | 'buddy-day' | 'buddy-time' | 'time-pick' | 'time-buddy' | 'options' | 'confirm' | 'success';
type FrequencyType = 'daily' | 'weekly' | 'everyXDays';

// Plain words for the repeat choice, e.g. "Every week" / "Every 3 days".
function frequencyLabel(frequency: FrequencyType, everyXDays: number): string {
  if (frequency === 'daily') return 'Every day';
  if (frequency === 'weekly') return 'Every week';
  return `Every ${everyXDays} day${everyXDays === 1 ? '' : 's'}`;
}

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

function buddyLabel(buddy: BookableBuddy | null): string {
  return buddy?.name ?? 'Buddy';
}

function buddyInitials(buddy: BookableBuddy | null): string {
  const name = buddy?.name ?? 'B';
  return name.slice(0, 1).toUpperCase();
}

const CONFETTI_COLORS = ['#58cc02', '#1cb0f6', '#a5ed6e', '#ff9600', '#ff4b4b'];
const CONFETTI_PIECE_COUNT = 16;

// A one-shot, dependency-free confetti burst — small colored pieces flying
// outward from the center and fading out. Pure CSS animation (see
// .confetti-piece in index.css), so it plays once on mount and never
// replays just because the parent re-renders.
function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_PIECE_COUNT }, (_, i) => {
        const angle = (i / CONFETTI_PIECE_COUNT) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
        const distance = 55 + Math.random() * 65;
        return {
          id: i,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          rot: 180 + Math.random() * 540,
          delay: Math.random() * 100,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          isCircle: i % 3 === 0,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`confetti-piece ${p.isCircle ? 'rounded-full' : 'rounded-sm'}`}
          style={
            {
              width: p.isCircle ? 7 : 9,
              height: p.isCircle ? 7 : 6,
              backgroundColor: p.color,
              animationDelay: `${p.delay}ms`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

const STEPPER_BUTTON_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-b-[3px] border-brand-primary-border bg-brand-primary text-base font-bold leading-none text-text-inverse disabled:border-border disabled:bg-bg-surface disabled:text-text-secondary disabled:opacity-50';

// Plain number inputs let the DOM keep stray leading zeros / decimals React
// won't re-render away (e.g. typing "02"). A stepper sidesteps that
// entirely — the display is always just the current integer.
function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={STEPPER_BUTTON_CLASS}
        aria-label="Decrease"
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-bold text-text-heading">{value}</span>
      <button
        type="button"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        className={STEPPER_BUTTON_CLASS}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
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
  // date string ("YYYY-MM-DD") -> has at least one bookable slot. Missing
  // entries are treated as available (fail open) — see pickBuddy's catch.
  const [dayAvailability, setDayAvailability] = useState<Record<string, boolean>>({});
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);

  const [timeInput, setTimeInput] = useState('10:00');
  const [timeBuddies, setTimeBuddies] = useState<BookableBuddy[]>([]);

  // Which step to return to from 'options' — it's reachable from either the
  // Book-by-Buddy or Book-by-Time flow, so a plain setStep('back one') won't do.
  const [optionsOrigin, setOptionsOrigin] = useState<Step>('buddy-time');

  const [bookingType, setBookingType] = useState<'single' | 'recurring'>('single');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('weekly');
  const [everyXDays, setEveryXDays] = useState(2);
  const [includeWeekends, setIncludeWeekends] = useState(true);
  const [occurrenceCount, setOccurrenceCount] = useState(4);
  const [recurringBuddyMode, setRecurringBuddyMode] = useState<'fixed' | 'any'>('fixed');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SingleResult | RecurringResult | null>(null);
  // Collapsed by default — a long list of identical "Buddy unavailable"
  // rows buries the actual outcome (the booked sessions) on a screen meant
  // to feel like a confirmation, not a report.
  const [showSkipped, setShowSkipped] = useState(false);
  // The "you can edit later" / "email sent" notes are secondary info —
  // tucked behind a hint icon so the success screen stays a quick, clean
  // confirmation rather than always showing two more lines of text.
  const [showHints, setShowHints] = useState(false);

  // The confirm screen's calendar for a recurring booking: the server's
  // planned dates and which are free (busy ones are skipped, not replaced).
  const [preview, setPreview] = useState<{ date: Date; available: boolean }[] | null>(null);
  useEffect(() => {
    if (step !== 'confirm' || bookingType !== 'recurring' || !token || !selectedStartTime) return;
    let superseded = false;
    setPreview(null);
    previewRecurringLessons(token, recurringPayload())
      .then((res) => {
        if (!superseded) setPreview(res.occurrences.map((o) => ({ date: new Date(o.startTime), available: o.available })));
      })
      .catch(() => {
        if (!superseded) showToast('Could not check your lesson days. Please try again.', 'error');
      });
    return () => {
      superseded = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const creditsPerLesson = useLessonPrice();

  // Only for arriving without enough credits for one lesson: a booking that
  // spends the last of them must still land on the "Booked!" screen (result
  // is set by then).
  useEffect(() => {
    if (account && account.credits < creditsPerLesson && !result) {
      showToast(`You need ${creditsLabel(creditsPerLesson)} to book a lesson.`, 'error');
      navigate('/credits');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, creditsPerLesson]);

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

  if (!token || !account || (account.credits < creditsPerLesson && !result)) return null;

  // The lesson price for each free planned date (busy ones aren't booked or charged).
  const lessonsToBook =
    bookingType === 'single' ? 1 : preview ? preview.filter((o) => o.available).length : occurrenceCount;
  const creditsToUse = lessonsToBook * creditsPerLesson;

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

  async function pickBuddy(buddy: BookableBuddy) {
    setSelectedBuddy(buddy);
    setSelectedDate(toLocalDateString(nextDays(1)[0]));
    setIsLoading(true);
    try {
      const results = await Promise.all(
        nextDays(14).map(async (d) => {
          const value = toLocalDateString(d);
          const res = await fetchBuddySlots(token!, buddy.id, value, VIEWER_TIMEZONE);
          return [value, res.slots.length > 0] as const;
        }),
      );
      setDayAvailability(Object.fromEntries(results));
    } catch {
      // Leave dayAvailability as-is — missing entries default to available,
      // so a failed check here doesn't block booking; pickDay() below still
      // shows "no times available" for a genuinely empty day.
    } finally {
      setIsLoading(false);
      setStep('buddy-day');
    }
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
    setOptionsOrigin('buddy-time');
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
    setOptionsOrigin('time-buddy');
    setStep('options');
  }

  function frequencyPayload(): RecurringFrequency {
    if (frequencyType === 'everyXDays') return { type: 'everyXDays', days: Math.max(1, everyXDays) };
    return { type: frequencyType };
  }

  function recurringPayload() {
    return {
      buddyId: recurringBuddyMode === 'fixed' ? selectedBuddy!.id : undefined,
      startTime: selectedStartTime!,
      frequency: frequencyPayload(),
      includeWeekends,
      occurrenceCount,
      timezone: VIEWER_TIMEZONE,
    };
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      if (bookingType === 'single') {
        const res = await bookLesson(token!, selectedBuddy!.id, selectedStartTime!);
        setCredits(res.creditsRemaining);
        setResult({ kind: 'single', lesson: res.lesson });
      } else {
        const res = await bookRecurringLessons(token!, recurringPayload());
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
        {step !== 'success' && (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-xs font-bold uppercase tracking-wide text-text-secondary"
          >
            Cancel
          </button>
        )}
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
              const available = dayAvailability[value] !== false;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!available}
                  onClick={() => pickDay(value)}
                  className={
                    available
                      ? 'rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-3 text-sm font-bold text-text-heading'
                      : 'cursor-not-allowed rounded-md border-2 border-border bg-[#f0f0f0] p-3 text-sm font-bold text-text-secondary opacity-60'
                  }
                >
                  {d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </button>
              );
            })}
          </div>
          {/* Arriving with a Buddy already chosen (e.g. from the Buddies tab)
              skips the picker, so its list was never loaded: load it now. */}
          <button
            type="button"
            onClick={() => (buddies.length > 0 ? setStep('buddy-pick') : startByBuddy())}
            className="mt-4 text-sm font-bold text-brand-secondary"
          >
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">How many lessons?</h2>
          {/* Icon + big number + short word, so the choice reads at a glance
              for learners still building their English. */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { type: 'single', Icon: CalendarCheck, number: '1', label: 'One lesson' },
                { type: 'recurring', Icon: Repeat, number: '2+', label: 'Many lessons' },
              ] as const
            ).map(({ type, Icon, number, label }) => (
              <button
                key={type}
                type="button"
                aria-pressed={bookingType === type}
                onClick={() => setBookingType(type)}
                className={
                  bookingType === type
                    ? 'flex flex-col items-center gap-1 rounded-md border-2 border-b-[4px] border-brand-primary-border bg-brand-primary p-3 text-text-inverse'
                    : 'flex flex-col items-center gap-1 rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-3 text-text-heading'
                }
              >
                <Icon size={26} aria-hidden="true" />
                <span className="text-3xl font-extrabold leading-none">{number}</span>
                <span className="text-sm font-bold">{label}</span>
              </button>
            ))}
          </div>

          {bookingType === 'recurring' && (
            <div className="rounded-md border-2 border-accent-lime bg-accent-lime-light p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-success">How often?</p>
              <div className="mb-3 flex flex-wrap gap-2">
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
                    {f === 'daily' ? 'Every day' : f === 'weekly' ? 'Every week' : 'Other'}
                  </button>
                ))}
              </div>

              {frequencyType === 'everyXDays' && (
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text-heading">
                  Every
                  <Stepper value={everyXDays} min={1} onChange={setEveryXDays} />
                  days
                </div>
              )}

              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-text-heading">
                <input type="checkbox" checked={includeWeekends} onChange={(e) => setIncludeWeekends(e.target.checked)} />
                Also on Saturday and Sunday
              </label>

              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text-heading">
                How many lessons?
                <Stepper
                  value={occurrenceCount}
                  min={1}
                  max={Math.max(1, Math.floor(account.credits / creditsPerLesson))}
                  onChange={setOccurrenceCount}
                />
              </div>

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
                You only pay {creditsLabel(creditsPerLesson)} for each lesson we book. If a time is not free, we skip it and
                tell you.
              </p>
            </div>
          )}

          <Button onClick={() => setStep('confirm')}>Continue</Button>
          <button
            type="button"
            onClick={() => setStep(optionsOrigin)}
            className="text-center text-sm font-bold text-text-secondary"
          >
            Back
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Confirm booking</h2>
          <div className="overflow-hidden rounded-md border-2 border-b-[4px] border-border">
            {[
              { label: 'Buddy', value: recurringBuddyMode === 'any' ? 'First available' : buddyLabel(selectedBuddy) },
              { label: 'Time', value: selectedStartTime ? formatDateTime(selectedStartTime) : '' },
              { label: 'Lessons', value: bookingType === 'recurring' ? `Many · ${frequencyLabel(frequencyType, everyXDays)}` : 'One' },
              { label: 'Credits', value: `${creditsToUse} credit${creditsToUse === 1 ? '' : 's'}` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-t border-border bg-bg-surface px-4 py-3 first:border-t-0">
                <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">{row.label}</span>
                <span className="text-sm font-bold text-text-heading">{row.value}</span>
              </div>
            ))}
          </div>

          {selectedStartTime && (
            <LessonCalendarPreview
              recurring={bookingType === 'recurring'}
              loading={bookingType === 'recurring' && preview === null}
              lessons={bookingType === 'single' ? [{ date: new Date(selectedStartTime), available: true }] : (preview ?? [])}
            />
          )}

          <div className="rounded-md border-2 border-accent-lime bg-accent-lime-light p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-success">Balance after booking</p>
            <p className="mt-0.5 text-base font-bold text-text-heading">
              {account.credits - creditsToUse} credits remaining
            </p>
          </div>

          {account.emailConfirmed ? (
            <Button onClick={handleConfirm} disabled={isSubmitting || lessonsToBook === 0}>
              {isSubmitting ? 'Confirming…' : 'Confirm & book'}
            </Button>
          ) : (
            <EmailConfirmationNotice action="book this lesson" />
          )}
          <button type="button" onClick={() => setStep('options')} className="text-center text-sm font-bold text-text-secondary">
            Back
          </button>
        </div>
      )}

      {step === 'success' && result && (
        <div className="flex flex-col gap-4 text-center">
          <div className="relative mx-auto flex h-10 w-10 items-center justify-center">
            <PartyPopper size={40} className="text-brand-primary" />
            <ConfettiBurst />
          </div>
          <h2 className="font-display text-2xl font-black text-brand-primary">Booked!</h2>

          {result.kind === 'single' && (
            <p className="text-sm font-bold text-text-secondary">{formatDateTime(result.lesson.startTime)}</p>
          )}

          {result.kind === 'recurring' && (
            <div className="text-left">
              <p className="mb-3 text-sm font-bold text-text-heading">
                {result.booked.length} of {result.booked.length + result.skipped.length} sessions booked
              </p>

              {result.booked.length > 0 && (
                <ul className="mb-3 flex flex-col gap-1">
                  {result.booked.map((lesson) => (
                    <li key={lesson.id} className="rounded-md bg-accent-lime-light px-3 py-2 text-sm font-bold text-success">
                      {formatDateTime(lesson.startTime)}
                    </li>
                  ))}
                </ul>
              )}

              {result.skipped.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowSkipped((v) => !v)}
                    className="flex w-full items-center justify-between rounded-md bg-warning/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-warning"
                  >
                    <span>{result.skipped.length} session(s) skipped</span>
                    <span>{showSkipped ? '▲' : '▼'}</span>
                  </button>

                  {showSkipped && (
                    <div className="mt-2 flex flex-col gap-3">
                      {Object.entries(
                        result.skipped.reduce<Record<string, string[]>>((groups, s) => {
                          (groups[s.reason] ??= []).push(s.startTime);
                          return groups;
                        }, {}),
                      ).map(([reason, startTimes]) => (
                        <div key={reason}>
                          <p className="mb-1.5 text-xs font-medium text-text-secondary">{reason}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {startTimes.map((startTime) => (
                              <span
                                key={startTime}
                                className="rounded-md bg-warning/10 px-2.5 py-1.5 text-xs font-bold text-warning"
                              >
                                {formatDateTime(startTime)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowHints((v) => !v)}
              className="mx-auto flex items-center gap-1 text-xs font-bold text-text-secondary"
            >
              <Info size={14} />
              Good to know
            </button>
            {showHints && (
              <div className="mt-2 flex flex-col gap-1.5 rounded-md border-2 border-brand-secondary bg-brand-secondary/10 p-3 text-left">
                {result.kind === 'recurring' && (
                  <p className="text-xs font-medium text-text-body">
                    You can edit or cancel individual sessions later from your Dashboard.
                  </p>
                )}
                <p className="text-xs font-medium text-text-body">Confirmation email sent with your meeting link.</p>
              </div>
            )}
          </div>
          {account.credits < creditsPerLesson && (
            <div className="rounded-md border-2 border-brand-secondary bg-brand-secondary/10 p-4 text-left">
              <p className="text-sm font-extrabold text-text-heading">
                You have {creditsLabel(account.credits)} left — a lesson costs {creditsLabel(creditsPerLesson)}.
              </p>
              <p className="mt-0.5 text-xs font-bold text-text-secondary">Top up now to book your next lesson.</p>
              <Button tone="blue" size="sm" className="mt-3 w-full" onClick={() => navigate('/credits')}>
                Buy credits
              </Button>
            </div>
          )}
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      )}
    </main>
  );
}
