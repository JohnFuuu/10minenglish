import { useEffect, useRef, useState } from 'react';
import { Avatar, BottomNav, Button, Card, Input, NAV_CLEARANCE_CLASS } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { initialsOf } from '../lib/initials';
import { LEARNING_GOALS } from '../lib/learningGoals';
import {
  ApiError,
  changePassword,
  fetchNotifications,
  fetchProfile,
  updateProfile,
  uploadPicture,
  type UserProfile,
} from '../lib/api';

interface ProfileForm {
  name: string;
  email: string;
  picture: string;
  phoneNumber: string;
  location: string;
  nationality: string;
  dateOfBirth: string;
  learningGoals: string[];
  learningGoalOther: string;
}

function toForm(profile: UserProfile): ProfileForm {
  return {
    name: profile.name ?? '',
    email: profile.email,
    picture: profile.picture ?? '',
    phoneNumber: profile.phoneNumber ?? '',
    location: profile.location ?? '',
    nationality: profile.nationality ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    learningGoals: profile.learningGoals,
    learningGoalOther: profile.learningGoalOther ?? '',
  };
}

const FIELD_LABEL = 'mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary';

export function ProfileScreen() {
  const { token, refreshAccount, logout } = useAuth();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const pictureInputRef = useRef<HTMLInputElement>(null);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchProfile(token)
      .then((p) => {
        setProfile(p);
        setForm(toForm(p));
      })
      .catch(() => showToast('Could not load your profile.', 'error'))
      .finally(() => setIsLoading(false));
    // showToast is stable (useCallback in ToastProvider); profile is fetched once per token.
  }, [token, showToast]);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
  }, [token]);

  function updateField<K extends keyof ProfileForm>(field: K) {
    return (value: ProfileForm[K]) => setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  // Uploads immediately (not gated behind "Save changes") — the endpoint
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

  function toggleGoal(goal: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const selected = prev.learningGoals.includes(goal);
      return {
        ...prev,
        learningGoals: selected
          ? prev.learningGoals.filter((g) => g !== goal)
          : [...prev.learningGoals, goal],
      };
    });
  }

  // Edits aren't applied until "Save changes" is pressed, so the button stays
  // disabled while the form still matches what the server returned.
  const isDirty = Boolean(profile && form) && JSON.stringify(toForm(profile!)) !== JSON.stringify(form);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !token) return;

    setIsSaving(true);
    try {
      const updated = await updateProfile(token, {
        name: form.name,
        email: form.email,
        picture: form.picture,
        phoneNumber: form.phoneNumber,
        location: form.location,
        nationality: form.nationality,
        dateOfBirth: form.dateOfBirth,
        learningGoals: form.learningGoals,
        learningGoalOther: form.learningGoals.includes('Other') ? form.learningGoalOther : '',
      });
      setProfile(updated);
      setForm(toForm(updated));
      // Location feeds isNZLocated on the session, which gates the POLi option.
      await refreshAccount();

      if (updated.pendingEmail) {
        showToast(
          `Changes saved. Confirm ${updated.pendingEmail} from your inbox to finish switching your email.`,
          'success',
        );
      } else {
        showToast('Changes saved.', 'success');
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save your profile.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setIsSavingPassword(true);
    try {
      await changePassword(token, passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      showToast('Password updated.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not change your password.', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <main className={`mx-auto max-w-3xl px-8 pt-12 ${NAV_CLEARANCE_CLASS}`}>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-text-heading">Profile</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-text-secondary">Loading your profile…</p>}

      {!isLoading && profile && form && (
        <>
          <Card className="mb-6">
            <div className="flex items-center gap-4">
              {form.picture ? (
                <img
                  src={form.picture}
                  alt={form.name}
                  className="h-14 w-14 shrink-0 rounded-full border-2 border-accent-lime object-cover"
                />
              ) : (
                <Avatar initials={initialsOf(form.name)} size={56} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-text-body">{profile.name}</p>
                <p className="truncate text-sm text-text-secondary">{profile.email}</p>
                {profile.pendingEmail && (
                  <p className="mt-1 text-xs font-bold text-brand-secondary">
                    Pending: {profile.pendingEmail} — confirm it from your inbox to switch.
                  </p>
                )}
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
          </Card>

          <form onSubmit={handleSave}>
            <Card className="mb-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={FIELD_LABEL} htmlFor="profile-name">
                    Name
                  </label>
                  <Input
                    id="profile-name"
                    value={form.name}
                    onChange={(e) => updateField('name')(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={FIELD_LABEL} htmlFor="profile-email">
                    Email
                  </label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email')(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={FIELD_LABEL} htmlFor="profile-phone">
                    Phone number
                  </label>
                  <Input
                    id="profile-phone"
                    value={form.phoneNumber}
                    onChange={(e) => updateField('phoneNumber')(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={FIELD_LABEL} htmlFor="profile-location">
                    Location
                  </label>
                  <Input
                    id="profile-location"
                    value={form.location}
                    onChange={(e) => updateField('location')(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={FIELD_LABEL} htmlFor="profile-nationality">
                    Nationality
                  </label>
                  <Input
                    id="profile-nationality"
                    value={form.nationality}
                    onChange={(e) => updateField('nationality')(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={FIELD_LABEL} htmlFor="profile-dob">
                    Date of birth
                  </label>
                  <Input
                    id="profile-dob"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => updateField('dateOfBirth')(e.target.value)}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={FIELD_LABEL} htmlFor="profile-picture">
                    Profile picture URL
                  </label>
                  <Input
                    id="profile-picture"
                    placeholder="https://…"
                    value={form.picture}
                    onChange={(e) => updateField('picture')(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4">
                <p className={FIELD_LABEL}>What are you hoping to get from 10ME?</p>
                <div className="flex flex-wrap gap-2">
                  {LEARNING_GOALS.map((goal) => {
                    const selected = form.learningGoals.includes(goal);
                    return (
                      <button
                        type="button"
                        key={goal}
                        onClick={() => toggleGoal(goal)}
                        className={
                          selected
                            ? 'rounded-md border-2 border-brand-primary bg-brand-primary px-4 py-2 text-sm font-bold text-text-inverse'
                            : 'rounded-md border-2 border-border px-4 py-2 text-sm font-bold text-text-secondary'
                        }
                      >
                        {goal}
                      </button>
                    );
                  })}
                </div>
                {form.learningGoals.includes('Other') && (
                  <Input
                    className="mt-2"
                    placeholder="Tell us more"
                    value={form.learningGoalOther}
                    onChange={(e) => updateField('learningGoalOther')(e.target.value)}
                  />
                )}
              </div>
            </Card>

            <Button type="submit" size="md" className="w-full" disabled={!isDirty || isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>

          {profile.hasPassword && (
            <form onSubmit={handleChangePassword} className="mt-10">
              <h2 className="mb-4 text-lg font-bold text-text-body">Change password</h2>
              <Card className="mb-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={FIELD_LABEL} htmlFor="current-password">
                      Current password
                    </label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className={FIELD_LABEL} htmlFor="new-password">
                      New password
                    </label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
              </Card>

              <Button
                type="submit"
                variant="secondary"
                size="md"
                className="w-full"
                disabled={
                  isSavingPassword || !passwordForm.currentPassword || !passwordForm.newPassword
                }
              >
                {isSavingPassword ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
        </>
      )}

      <BottomNav unreadCount={unreadCount} />
    </main>
  );
}
