import { useState } from 'react';
import { AddBuddyForm } from './AddBuddyForm';
import { AdminLayout } from './AdminLayout';
import { BuddyRoster } from './BuddyRoster';

export function AdminBuddiesPage() {
  // Bumped after provisioning so the roster picks up the new Buddy.
  const [rosterKey, setRosterKey] = useState(0);
  return (
    <AdminLayout title="Buddies" liveChanges>
      <BuddyRoster refreshKey={rosterKey} />
      <AddBuddyForm onCreated={() => setRosterKey((k) => k + 1)} />
    </AdminLayout>
  );
}
