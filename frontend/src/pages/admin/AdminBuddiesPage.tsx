import { useState } from 'react';
import { Button } from '../../components';
import { useToast } from '../../toast/ToastContext';
import { AddBuddyForm } from './AddBuddyForm';
import { AdminLayout } from './AdminLayout';
import { BuddyRoster } from './BuddyRoster';

export function AdminBuddiesPage() {
  const { showToast } = useToast();
  // Bumped after provisioning so the roster picks up the new Buddy.
  const [rosterKey, setRosterKey] = useState(0);
  // The form opens on demand above the roster, so it never ends up buried
  // below a long list of Buddies.
  const [isAdding, setIsAdding] = useState(false);

  return (
    <AdminLayout title="Buddies" liveChanges>
      {isAdding ? (
        <AddBuddyForm
          onCancel={() => setIsAdding(false)}
          onCreated={(email) => {
            setIsAdding(false);
            setRosterKey((k) => k + 1);
            showToast(`Account created for ${email}.`, 'success');
          }}
        />
      ) : (
        <Button className="mb-8 w-full" onClick={() => setIsAdding(true)}>
          + Add Buddy
        </Button>
      )}
      <BuddyRoster refreshKey={rosterKey} />
    </AdminLayout>
  );
}
