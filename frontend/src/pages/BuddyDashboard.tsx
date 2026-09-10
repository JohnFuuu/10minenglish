import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Card, Input, NavItem } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { initialsOf } from '../lib/initials';
import {
  ApiError,
  buddyCancelLesson,
  fetchBuddyProfile,
  fetchNotifications,
  fetchTeachingLessons,
  updateBuddyAvailability,
  updateBuddyProfile,
  type AvailabilityBlock,
  type BuddyProfile,
  type LessonWithUser,
} from '../lib/api';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i); // 8am - 6pm, 1h slots

function hourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

function blockKey(dayOfWeek: number, hour: number): string {
  return `${dayOfWeek}-${hour}`;
}

export function BuddyDashboard() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingLessons, setUpcomingLessons] = useState<LessonWithUser[]>([]);
  const [previousLessons, setPreviousLessons] = useState<LessonWithUser[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchTeachingLessons(token).then((res) => {
      setUpcomingLessons(res.upcoming);
      setPreviousLessons(res.previous);
    });
  }, [token]);

  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [form, setForm] = useState({ name: '', picture: '', bio: '', location: '', timezone: '', zoomLink: '' });
  const [selectedHours, setSelectedHours] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchBuddyProfile(token).then((p) => {
      setProfile(p);
      setForm({
        name: p.name ?? '',
        picture: p.picture ?? '',
        bio: p.bio ?? '',
        location: p.location ?? '',
        timezone: p.timezone ?? '',
        zoomLink: p.zoomLink ?? '',
      });
      setSelectedHours(new Set(p.availabilityBlocks.map((b) => blockKey(b.dayOfWeek, hourFromBlock(b)))));
    });
  }, [token]);

  function hourFromBlock(block: AvailabilityBlock): number {
    return Number(block.startTime.split(':')[0]);
  }

  function toggleHour(dayOfWeek: number, hour: number) {
    const key = blockKey(dayOfWeek, hour);
    setSelectedHours((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSavingProfile(true);
    try {
      const updated = await updateBuddyProfile(token!, form);
      setProfile(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch {
      setError('Could not save your profile. Check your timezone is a valid IANA zone (e.g. Pacific/Auckland).');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSaveAvailability() {
    setError(null);
    setIsSavingAvailability(true);
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
      setAvailabilitySaved(true);
      setTimeout(() => setAvailabilitySaved(false), 2500);
    } catch {
      setError('Could not save your availability. Set a timezone in your profile first.');
    } finally {
      setIsSavingAvailability(false);
    }
  }

  async function handleCancelLesson(lesson: LessonWithUser) {
    setCancellingId(lesson.id);
    try {
      await buddyCancelLesson(token!, lesson.id);
      setUpcomingLessons((current) => current.filter((l) => l.id !== lesson.id));
      setConfirmingId(null);
      showToast("Lesson cancelled — the User's credit was refunded.", 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not cancel this lesson.', 'error');
    } finally {
      setCancellingId(null);
    }
  }

  function formatLessonTime(iso: string): string {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (!profile) return null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-text-heading">Buddy Dashboard</h1>
        <Button variant="secondary" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-md border-2 border-b-[5px] border-brand-primary-border bg-brand-primary p-4">
        {profile.picture ? (
          <img
            src={profile.picture}
            alt={profile.name}
            className="h-14 w-14 shrink-0 rounded-xl border-2 border-accent-lime-light object-cover"
          />
        ) : (
          <Avatar initials={initialsOf(profile.name)} size={56} />
        )}
        <div className="min-w-0">
          <p className="truncate font-bold text-text-inverse">{profile.name || 'Your Buddy profile'}</p>
          <p className="truncate text-sm text-accent-lime-light">{profile.email}</p>
        </div>
      </div>

      <NavItem
        label="Notifications"
        badge={unreadCount > 0 ? <Badge count={unreadCount} /> : undefined}
        onClick={() => navigate('/notifications')}
        className="mb-6"
      />

      {!profile.zoomLink && (
        <div className="mb-6 flex items-center gap-2 rounded-md border-2 border-warning bg-warning/10 px-3 py-2">
          <span>⚠️</span>
          <p className="text-xs font-bold uppercase tracking-wide text-text-body">
            Add a Zoom link — Users cannot book you without it.
          </p>
        </div>
      )}

      {error && <p className="mb-4 text-sm font-bold text-error">{error}</p>}

      <section className="mb-10">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-secondary">Profile</h2>

        {profileSaved && (
          <div className="mb-4 rounded-md border-2 border-accent-lime bg-accent-lime-light px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-success">Profile saved.</p>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            placeholder="Picture URL"
            value={form.picture}
            onChange={(e) => setForm({ ...form, picture: e.target.value })}
          />
          <Input placeholder="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <Input
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <Input
            placeholder="Timezone (e.g. Pacific/Auckland)"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
          <Input
            placeholder="Zoom link"
            value={form.zoomLink}
            onChange={(e) => setForm({ ...form, zoomLink: e.target.value })}
          />
          <Button type="submit" disabled={isSavingProfile}>
            Save Profile
          </Button>
        </form>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Weekly availability</h2>
          <span className="text-xs font-bold text-brand-secondary">{profile.timezone ?? 'Set a timezone first'}</span>
        </div>
        <p className="mb-4 text-sm font-medium text-text-secondary">
          Tap a slot to toggle it. Users can only book active slots.
        </p>

        {availabilitySaved && (
          <div className="mb-4 rounded-md border-2 border-accent-lime bg-accent-lime-light px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-success">Availability saved.</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-max border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-16" />
                {DAY_LABELS.map((label) => (
                  <th
                    key={label}
                    className="w-10 text-center text-xs font-bold uppercase tracking-wide text-text-secondary"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="pr-2 text-right text-xs font-bold text-text-body">{hourLabel(hour)}</td>
                  {DAY_LABELS.map((_, dayOfWeek) => {
                    const active = selectedHours.has(blockKey(dayOfWeek, hour));
                    return (
                      <td key={dayOfWeek}>
                        <button
                          type="button"
                          onClick={() => toggleHour(dayOfWeek, hour)}
                          className={
                            active
                              ? 'h-9 w-10 rounded-md border-2 border-b-[3px] border-brand-primary-border bg-brand-primary'
                              : 'h-9 w-10 rounded-md border-2 border-b-[3px] border-border bg-bg-surface'
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <Button onClick={handleSaveAvailability} disabled={isSavingAvailability}>
            Save Availability
          </Button>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-secondary">
          Upcoming Lessons to teach
        </h2>

        {upcomingLessons.length === 0 && (
          <p className="text-sm text-text-secondary">No upcoming lessons.</p>
        )}

        <div className="flex flex-col gap-3">
          {upcomingLessons.map((lesson) => (
            <Card key={lesson.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-text-body">{lesson.userName}</p>
                  <p className="text-sm text-text-secondary">{formatLessonTime(lesson.startTime)}</p>
                </div>
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
                      onClick={() => handleCancelLesson(lesson)}
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

      <section className="mt-10">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-secondary">
          Previous Lessons taught
        </h2>

        {previousLessons.length === 0 && (
          <p className="text-sm text-text-secondary">No previous lessons yet.</p>
        )}

        <div className="flex flex-col gap-3">
          {previousLessons.map((lesson) => (
            <Card key={lesson.id} className="opacity-80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-text-body">{lesson.userName}</p>
                  <p className="text-sm text-text-secondary">{formatLessonTime(lesson.startTime)}</p>
                </div>
                <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                  {lesson.status === 'cancelled' ? 'Cancelled' : 'Taught'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
