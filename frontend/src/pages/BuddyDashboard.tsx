import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarDays, Clock, User } from 'lucide-react';
import { Avatar, BottomNav, Card, NAV_CLEARANCE_CLASS } from '../components';
import { useAuth } from '../auth/AuthContext';
import { initialsOf } from '../lib/initials';
import { fetchBuddyProfile, fetchTeachingLessons, type BuddyProfile, type LessonWithUser } from '../lib/api';
import { formatDateTime } from '../lib/formatDateTime';
import { useUnreadCount } from '../lib/useUnreadCount';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const QUICK_ACTIONS = [
  { label: 'TEACHING', icon: CalendarDays, path: '/teaching' },
  { label: 'AVAILABILITY', icon: Clock, path: '/availability' },
  { label: 'PROFILE', icon: User, path: '/profile' },
] as const;

export function BuddyDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const unreadCount = useUnreadCount(token);
  const [nextLesson, setNextLesson] = useState<LessonWithUser | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchBuddyProfile(token).then(setProfile);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchTeachingLessons(token).then((res) => setNextLesson(res.upcoming[0] ?? null));
  }, [token]);

  if (!profile) return null;

  return (
    <main className={`mx-auto max-w-3xl px-5 ${NAV_CLEARANCE_CLASS}`}>
      <div className="flex items-center justify-between border-b-2 border-border pb-4 pt-8">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-11 w-11" />
          <span className="font-display text-xl font-black text-brand-primary">10ME</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="relative flex h-9 w-9 items-center justify-center rounded-md border-2 border-b-[3px] border-border"
        >
          <Bell size={18} color="#3c3c3c" strokeWidth={2.5} />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[9px] font-bold text-text-inverse">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="pb-2 pt-5">
        <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">{greeting()},</p>
        <h1 className="font-display text-3xl font-black text-text-heading">
          {(profile.name || 'there').split(' ')[0]}!
        </h1>
      </div>

      <div className="my-5 flex items-center gap-3 rounded-md border-2 border-b-[5px] border-brand-primary-border bg-brand-primary p-4">
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

      {!profile.zoomLink && (
        <div className="mb-5 flex items-center gap-2 rounded-md border-2 border-warning bg-warning/10 px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 text-warning" />
          <p className="text-xs font-bold uppercase tracking-wide text-text-body">
            Add a Zoom link — Users cannot book you without it.
          </p>
        </div>
      )}

      {nextLesson && (
        <div className="mb-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Next lesson</p>
          <Card>
            <div className="flex items-center gap-3">
              <Avatar initials={initialsOf(nextLesson.userName)} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text-heading">{nextLesson.userName}</p>
                <p className="text-sm text-text-secondary">{formatDateTime(nextLesson.startTime)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="mb-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Quick actions</p>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.path)}
              className="flex flex-col items-start rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-3 text-left"
            >
              <action.icon className="mb-2 h-5 w-5 text-brand-primary" strokeWidth={2.5} />
              <span className="text-[10px] font-bold tracking-widest text-text-heading">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <BottomNav unreadCount={unreadCount} />
    </main>
  );
}
