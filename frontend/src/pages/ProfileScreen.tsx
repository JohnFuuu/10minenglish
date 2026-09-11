import { useRef, useState } from 'react';
import { AutocompleteInput, Avatar, BottomNav, Button, Card, Input, NAV_CLEARANCE_CLASS, PageHeader } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { PasswordVisibilityToggle } from '../auth/PasswordVisibilityToggle';
import { COUNTRY_NAMES, flagCodeForCountry, flagCodeForNationality, NATIONALITIES } from '../lib/countries';
import { initialsOf } from '../lib/initials';
import {
  ApiError,
  changePassword,
  fetchProfile,
  updateProfile,
  uploadPicture,
  type UserProfile,
} from '../lib/api';
import { readSessionCache } from '../lib/sessionCache';
import { useCachedFetch } from '../lib/useCachedFetch';
import { useUnreadCount } from '../lib/useUnreadCount';

const PROFILE_CACHE_KEY = '10me.cache.profile';

// Phone/date of birth/learning-goals were dropped from this screen — kept
// optional on the Account schema and in UserProfileUpdate, just no longer
// shown or editable here. The backend only touches fields it's actually
// sent (see routes/me.ts's `if (x !== undefined)` guards), so omitting them
// from the save payload leaves whatever a user already had untouched.
interface ProfileForm {
  name: string;
  email: string;
  picture: string;
  location: string;
  nationality: string;
}

function toForm(profile: UserProfile): ProfileForm {
  return {
    name: profile.name ?? '',
    email: profile.email,
    picture: profile.picture ?? '',
    location: profile.location ?? '',
    nationality: profile.nationality ?? '',
  };
}

export function ProfileScreen() {
  const { token, refreshAccount, logout } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState<ProfileForm | null>(() => {
    const cached = readSessionCache<UserProfile>(PROFILE_CACHE_KEY);
    return cached ? toForm(cached) : null;
  });
  const [profile, setProfile, isLoading] = useCachedFetch<UserProfile>(
    PROFILE_CACHE_KEY,
    () => fetchProfile(token!),
    [token],
    {
      enabled: Boolean(token),
      onSuccess: (p) => setForm(toForm(p)),
      onError: () => showToast('Could not load your profile.', 'error'),
    },
  );
  const [isSaving, setIsSaving] = useState(false);
  const unreadCount = useUnreadCount(token);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const pictureInputRef = useRef<HTMLInputElement>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const passwordsMismatch =
    passwordForm.newPassword.length > 0 &&
    passwordForm.confirmPassword.length > 0 &&
    passwordForm.newPassword !== passwordForm.confirmPassword;

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
        location: form.location,
        nationality: form.nationality,
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
    if (!token || passwordsMismatch) return;

    setIsSavingPassword(true);
    try {
      await changePassword(token, passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password updated.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not change your password.', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <main className={`mx-auto max-w-3xl px-8 pt-12 ${NAV_CLEARANCE_CLASS}`}>
      <PageHeader
        title="Profile"
        className="mb-8"
        right={
          <Button variant="secondary" size="sm" onClick={logout}>
            Log out
          </Button>
        }
      />

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
                <Input
                  id="profile-name"
                  label="Name"
                  value={form.name}
                  onChange={(e) => updateField('name')(e.target.value)}
                  required
                />

                <Input
                  id="profile-email"
                  type="email"
                  label="Email"
                  value={form.email}
                  onChange={(e) => updateField('email')(e.target.value)}
                  required
                />

                <AutocompleteInput
                  id="profile-nationality"
                  label="Nationality"
                  value={form.nationality}
                  onChange={updateField('nationality')}
                  options={NATIONALITIES}
                  getFlagCode={flagCodeForNationality}
                />

                <AutocompleteInput
                  id="profile-location"
                  label="Location"
                  value={form.location}
                  onChange={updateField('location')}
                  options={COUNTRY_NAMES}
                  getFlagCode={flagCodeForCountry}
                />
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
                <div className="flex flex-col gap-4">
                  <Input
                    id="current-password"
                    label="Current password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                    required
                    right={
                      <PasswordVisibilityToggle
                        visible={showCurrentPassword}
                        onToggle={() => setShowCurrentPassword((v) => !v)}
                      />
                    }
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      id="new-password"
                      label="New password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                      }
                      required
                      right={
                        <PasswordVisibilityToggle
                          visible={showNewPassword}
                          onToggle={() => setShowNewPassword((v) => !v)}
                        />
                      }
                    />

                    <Input
                      id="confirm-new-password"
                      label="Confirm new password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                      }
                      error={passwordsMismatch ? "Passwords don't match" : undefined}
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
                  isSavingPassword ||
                  !passwordForm.currentPassword ||
                  !passwordForm.newPassword ||
                  !passwordForm.confirmPassword ||
                  passwordsMismatch
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
