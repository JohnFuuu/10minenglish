import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { createAdmin, fetchAdmins, type AdminAccount } from '../../lib/api';
import { AdminLayout } from './AdminLayout';
import { AuditLogSection } from './AuditLogSection';
import { NewAccountForm } from './NewAccountForm';
import { MODULE_FRAME, SectionHeading } from './SectionHeading';

export function AdminAdminsPage() {
  const { token, account } = useAuth();
  const { showToast } = useToast();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const location = useLocation();

  // The old /admin/audit link lands here as #audit-log.
  useEffect(() => {
    if (location.hash === '#audit-log') document.getElementById('audit-log')?.scrollIntoView();
  }, [location.hash]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setAdmins((await fetchAdmins(token)).admins);
    } catch {
      showToast('Could not load the Admin list.', 'error');
    }
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminLayout title="Admins">
      <section className={`mb-10 ${MODULE_FRAME}`}>
        <SectionHeading className="mb-3">Admin accounts</SectionHeading>
        {isAdding ? (
          <NewAccountForm
            heading="Add Admin account"
            description="Admins can manage members, tags, Buddies, and prices. Give the starter password to them directly."
            submitLabel="Create Admin Account"
            create={createAdmin}
            onCancel={() => setIsAdding(false)}
            onCreated={(email) => {
              setIsAdding(false);
              load();
              setAuditRefreshKey((k) => k + 1);
              showToast(`Account created for ${email}.`, 'success');
            }}
          />
        ) : (
          <Button className="mb-4 w-full" onClick={() => setIsAdding(true)}>
            + Add Admin
          </Button>
        )}

        {admins.length > 0 && (
          <ul className="divide-y-2 divide-border overflow-hidden rounded-md border-2 border-b-4 border-border-strong bg-bg-surface">
            {admins.map((admin) => (
              <li key={admin.id} className="px-4 py-2.5">
                <p className="truncate text-sm font-bold text-text-heading">
                  {admin.name ?? admin.email}
                  {admin.id === account?.id && <span className="font-medium text-text-secondary"> (you)</span>}
                </p>
                <p className="truncate text-xs text-text-secondary">{admin.email}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AuditLogSection refreshKey={auditRefreshKey} />
    </AdminLayout>
  );
}
