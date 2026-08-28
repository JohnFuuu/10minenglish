import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Input, NavItem } from '../components';
import { useAuth } from '../auth/AuthContext';
import {
  fetchBuddyProfile,
  fetchNotifications,
  updateBuddyAvailability,
  updateBuddyProfile,
  type AvailabilityBlock,
  type BuddyProfile,
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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
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

  if (!profile) return null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-body">Buddy Dashboard</h1>
        <Button variant="secondary" size="sm" onClick={logout}>
          Log out
        </Button>
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
    </main>
  );
}
