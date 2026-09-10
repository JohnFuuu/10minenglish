import { useEffect, useRef, useState } from 'react';
import { Avatar, BottomNav, Button, Input, NAV_CLEARANCE_CLASS } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { initialsOf } from '../lib/initials';
import {
  ApiError,
  fetchBuddyProfile,
  fetchNotifications,
  updateBuddyProfile,
  uploadPicture,
  type BuddyProfile,
} from '../lib/api';

interface BuddyProfileForm {
  name: string;
  picture: string;
  bio: string;
  location: string;
  timezone: string;
  zoomLink: string;
}

function toForm(profile: BuddyProfile): BuddyProfileForm {
  return {
    name: profile.name ?? '',
    picture: profile.picture ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    timezone: profile.timezone ?? '',
    zoomLink: profile.zoomLink ?? '',
  };
}

export function BuddyProfileScreen() {
  const { token, logout } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [form, setForm] = useState<BuddyProfileForm | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const pictureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetchBuddyProfile(token).then((p) => {
      setProfile(p);
      setForm(toForm(p));
    });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
  }, [token]);

  function updateField<K extends keyof BuddyProfileForm>(field: K) {
    return (value: string) => setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  // Uploads immediately (not gated behind "Save profile") — the endpoint
  // saves it straight onto the Account, so form/profile are both updated
  // here to match rather than waiting for the next full-form save.
  async function handlePictureFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token) return;

    setIsUploadingPicture(true);
    try {
      const { picture } = await uploadPicture(token, file);
      setForm((prev) => (prev ? { ...prev, picture } : prev));
      setProfile((prev) => (prev ? { ...prev, picture } : prev));
      showToast('Photo uploaded.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not upload that photo.', 'error');
    } finally {
      setIsUploadingPicture(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setIsSaving(true);
    try {
      const updated = await updateBuddyProfile(token!, form);
      setProfile(updated);
      setForm(toForm(updated));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Could not save your profile. Check your timezone is a valid IANA zone (e.g. Pacific/Auckland).');
    } finally {
      setIsSaving(false);
    }
  }

  if (!profile || !form) return null;

  return (
    <main className={`mx-auto max-w-3xl px-5 ${NAV_CLEARANCE_CLASS}`}>
      <div className="flex items-center justify-between pb-2 pt-8">
        <h1 className="font-display text-2xl font-black text-text-heading">Profile</h1>
        <Button variant="secondary" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>

      <div className="my-4 rounded-md border-2 border-b-[5px] border-brand-primary-border bg-brand-primary p-4">
        <div className="flex items-center gap-3">
          {profile.picture ? (
            <img
              src={profile.picture}
              alt={profile.name}
              className="h-14 w-14 shrink-0 rounded-xl border-2 border-accent-lime-light object-cover"
            />
          ) : (
            <Avatar initials={initialsOf(profile.name)} size={56} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-text-inverse">{profile.name || 'Your Buddy profile'}</p>
            <p className="truncate text-sm text-accent-lime-light">{profile.email}</p>
          </div>
        </div>
        <input
          ref={pictureInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handlePictureFile}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          disabled={isUploadingPicture}
          onClick={() => pictureInputRef.current?.click()}
        >
          {isUploadingPicture ? 'Uploading…' : 'Upload photo'}
        </Button>
      </div>

      {!profile.zoomLink && (
        <div className="mb-4 flex items-center gap-2 rounded-md border-2 border-warning bg-warning/10 px-3 py-2">
          <span>⚠️</span>
          <p className="text-xs font-bold uppercase tracking-wide text-text-body">
            Add a Zoom link — Users cannot book you without it.
          </p>
        </div>
      )}

      {error && <p className="mb-4 text-sm font-bold text-error">{error}</p>}
      {saved && (
        <div className="mb-4 rounded-md border-2 border-accent-lime bg-accent-lime-light px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-success">Profile saved.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <Input placeholder="Name" value={form.name} onChange={(e) => updateField('name')(e.target.value)} />
        <Input placeholder="Bio" value={form.bio} onChange={(e) => updateField('bio')(e.target.value)} />
        <Input
          placeholder="Location"
          value={form.location}
          onChange={(e) => updateField('location')(e.target.value)}
        />
        <Input
          placeholder="Timezone (e.g. Pacific/Auckland)"
          value={form.timezone}
          onChange={(e) => updateField('timezone')(e.target.value)}
        />
        <Input
          placeholder="Zoom link"
          value={form.zoomLink}
          onChange={(e) => updateField('zoomLink')(e.target.value)}
        />
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save profile'}
        </Button>
      </form>

      <BottomNav unreadCount={unreadCount} />
    </main>
  );
}
