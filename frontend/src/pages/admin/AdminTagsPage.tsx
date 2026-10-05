import { AdminLayout } from './AdminLayout';
import { MemberTagsSection } from './MemberTagsSection';
import { useAdminTags } from './useAdminTags';

export function AdminTagsPage() {
  const { tags, reload } = useAdminTags();
  return (
    <AdminLayout title="Tags">
      <MemberTagsSection tags={tags} onChanged={reload} />
    </AdminLayout>
  );
}
