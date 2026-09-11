import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { BottomNav, Button, NAV_CLEARANCE_CLASS, PageHeader } from '../components';
import { useAuth } from '../auth/AuthContext';
import {
  fetchBuddyProfile,
  fetchNotifications,
  updateBuddyAvailability,
  type AvailabilityBlock,
  type BuddyProfile,
} from '../lib/api';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i); // 8am - 6pm, 1h slots

function hourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

function blockKey(dayOfWeek: number, hour: number): string {
  return `${dayOfWeek}-${hour}`;
}

function hourFromBlock(block: AvailabilityBlock): number {
  return Number(block.startTime.split(':')[0]);
}

export function BuddyAvailabilityScreen() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [selectedHours, setSelectedHours] = useState<Set<string>>(new Set());
  // One day visible at a time — the full week is still tracked in
  // selectedHours underneath, this just controls what's rendered, so a
  // 7-day-by-10-hour grid never has to fit sideways on a phone screen.
  const [activeDay, setActiveDay] = useState(() => new Date().getDay());
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchBuddyProfile(token).then((p) => {
      setProfile(p);
      setSelectedHours(new Set(p.availabilityBlocks.map((b) => blockKey(b.dayOfWeek, hourFromBlock(b)))));
    });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
  }, [token]);

  function toggleHour(dayOfWeek: number, hour: number) {
    const key = blockKey(dayOfWeek, hour);
    setSelectedHours((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function dayHasHours(dayOfWeek: number): boolean {
    return HOURS.some((hour) => selectedHours.has(blockKey(dayOfWeek, hour)));
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const blocks: AvailabilityBlock[] = [...selectedHours].map((key) => {
        const [dayOfWeek, hour] = key.split('-').map(Number);
        return {
          dayOfWeek,
          startTime: `${String(hour).padStart(2, '0')}:00`,
          endTime: `${String(hour + 1).padStart(2, '0')}:00`,
        };
      });
      const result = await updateBuddyAvailability(token!, blocks);
      setProfile((prev) => (prev ? { ...prev, availabilityBlocks: result.availabilityBlocks } : prev));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Could not save your availability. Set a timezone in your profile first.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <main className={`mx-auto max-w-3xl px-5 ${NAV_CLEARANCE_CLASS}`}>
      <PageHeader title="Availability" className="pb-2 pt-8" />

      <div className="mb-2 mt-4 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Weekly schedule</h2>
        <span className="text-xs font-bold text-brand-secondary">{profile.timezone ?? 'Set a timezone first'}</span>
      </div>
      <p className="mb-4 text-sm font-medium text-text-secondary">
        Tap a day, then tap the hours you're free. Users can only book active hours.
      </p>

      {error && <p className="mb-4 text-sm font-bold text-error">{error}</p>}
      {saved && (
        <div className="mb-4 rounded-md border-2 border-accent-lime bg-accent-lime-light px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-success">Availability saved.</p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((label, dayOfWeek) => {
          const active = activeDay === dayOfWeek;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveDay(dayOfWeek)}
              className={
                active
                  ? 'relative rounded-md border-2 border-b-[3px] border-brand-secondary-border bg-brand-secondary py-2 text-[11px] font-bold tracking-wide text-text-inverse'
                  : 'relative rounded-md border-2 border-b-[3px] border-border bg-bg-surface py-2 text-[11px] font-bold tracking-wide text-text-secondary'
              }
            >
              {label}
              {dayHasHours(dayOfWeek) && (
                <span
                  className={
                    active
                      ? 'absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-lime-light'
                      : 'absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-primary'
                  }
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {HOURS.map((hour) => {
          const active = selectedHours.has(blockKey(activeDay, hour));
          return (
            <button
              key={hour}
              type="button"
              onClick={() => toggleHour(activeDay, hour)}
              className={
                active
                  ? 'flex items-center justify-between rounded-md border-2 border-b-[3px] border-brand-primary-border bg-brand-primary px-4 py-3 text-sm font-bold text-text-inverse'
                  : 'flex items-center justify-between rounded-md border-2 border-b-[3px] border-border bg-bg-surface px-4 py-3 text-sm font-bold text-text-heading'
              }
            >
              {hourLabel(hour)}
              <span
                className={
                  active
                    ? 'flex h-5 w-5 items-center justify-center rounded-full bg-text-inverse text-xs text-brand-primary'
                    : 'h-5 w-5 rounded-full border-2 border-border'
                }
              >
                {active && <Check size={13} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save availability'}
        </Button>
      </div>

      <BottomNav unreadCount={unreadCount} />
    </main>
  );
}
