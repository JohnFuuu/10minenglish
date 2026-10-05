import { AdminLayout } from './AdminLayout';
import { MembersSection } from './MembersSection';
import { useAdminTags } from './useAdminTags';

// Admin home (/dashboard for an Admin): finding members and tagging them is
// the day-to-day task.
export function AdminMembersPage() {
  const { tags, reload } = useAdminTags();
  return (
    <AdminLayout title="Members">
      <MembersSection tags={tags} onTagsChanged={reload} />
    </AdminLayout>
  );
}
