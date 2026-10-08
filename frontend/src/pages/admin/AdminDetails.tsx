import type { AdminAccount } from '../../lib/api';
import { Field, formatDate } from './BuddyDetails';

// The expanded part of an Admin accounts row, styled like a Buddy's details.
export function AdminDetails({ admin }: { admin: AdminAccount }) {
  return (
    <div data-testid="admin-details" className="mt-3 flex flex-col gap-2.5 rounded-md bg-border/40 p-3">
      <Field label="Email">{admin.email}</Field>
      <Field label="Status">
        {admin.active ? 'Active' : 'Inactive — can’t sign in'} · joined {formatDate(admin.joinedAt)}
      </Field>
      <Field label="Role">
        {admin.isSuperAdmin ? 'Super admin — can deactivate and remove other Admins' : 'Admin'}
      </Field>
    </div>
  );
}
