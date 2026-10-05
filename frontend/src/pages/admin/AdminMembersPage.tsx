import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tags } from 'lucide-react';
import { Button } from '../../components';
import { AdminLayout } from './AdminLayout';
import { MembersSection } from './MembersSection';
import { MemberTagsSection } from './MemberTagsSection';
import { MODULE_FRAME, SectionHeading } from './SectionHeading';
import { useAdminTags } from './useAdminTags';

// Admin home (/dashboard for an Admin): finding and tagging members, with
// the tag list itself managed in a panel opened from here.
export function AdminMembersPage() {
  const [searchParams] = useSearchParams();
  const { tags, reload } = useAdminTags();
  // ?manageTags=1 is where the old /admin/tags link now lands.
  const [isManagingTags, setIsManagingTags] = useState(searchParams.get('manageTags') === '1');
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);

  return (
    <AdminLayout title="Members">
      {isManagingTags && (
        <div className={`mb-10 ${MODULE_FRAME}`}>
          <div className="mb-2 flex items-center justify-between">
            <SectionHeading className="mb-0">Member tags</SectionHeading>
            <Button size="sm" variant="secondary" onClick={() => setIsManagingTags(false)}>
              Done
            </Button>
          </div>
          <MemberTagsSection
            tags={tags}
            onChanged={() => {
              reload();
              // Renames and deletes change the chips on member rows.
              setMembersRefreshKey((k) => k + 1);
            }}
          />
        </div>
      )}
      <MembersSection
        tags={tags}
        onTagsChanged={reload}
        refreshKey={membersRefreshKey}
        toolbarAction={
          !isManagingTags && (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setIsManagingTags(true)}>
              <Tags size={14} aria-hidden="true" />
              Manage tags
            </Button>
          )
        }
      />
    </AdminLayout>
  );
}
