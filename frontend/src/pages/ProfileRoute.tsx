import { useAuth } from '../auth/AuthContext';
import { BuddyProfileScreen } from './BuddyProfileScreen';
import { ProfileScreen } from './ProfileScreen';

// /profile means something different per role — a User edits the full
// signup-form fields, a Buddy edits their teaching profile — so this picks
// the right screen the same way Dashboard.tsx picks a role's home screen.
export function ProfileRoute() {
  const { account } = useAuth();
  if (account?.role === 'buddy') return <BuddyProfileScreen />;
  return <ProfileScreen />;
}
