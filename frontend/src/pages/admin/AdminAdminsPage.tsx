import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { ApiError, createAdmin, fetchAdmins, removeAdmin, setAdminActive, type AdminAccount } from '../../lib/api';
import { AdminDetails } from './AdminDetails';
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
  const amSuperAdmin = admins.some((a) => a.id === account?.id && a.isSuperAdmin);
  // Which other Admin is asking "are you sure?", and about what.
  const [confirming, setConfirming] = useState<{ id: string; action: 'deactivate' | 'remove' } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // The open row, showing that Admin's details.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function act(admin: AdminAccount, action: 'deactivate' | 'activate' | 'remove') {
    if (!token) return;
    const name = admin.name ?? admin.email;
    setBusyId(admin.id);
    try {
      if (action === 'remove') {
        await removeAdmin(token, admin.id);
        setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
        showToast(`${name} removed.`, 'success');
      } else {
        const updated = await setAdminActive(token, admin.id, action === 'activate');
        setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, active: updated.active } : a)));
        showToast(updated.active ? `${name} can sign in again.` : `${name} deactivated.`, 'success');
      }
      setConfirming(null);
      setAuditRefreshKey((k) => k + 1);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : '';
      showToast(
        code === 'LAST_ACTIVE_ADMIN'
          ? 'At least one Admin must stay active.'
          : code === 'CANNOT_CHANGE_SELF'
            ? "You can't change your own account."
            : code === 'SUPER_ADMIN_REQUIRED'
              ? 'Only a super admin can do that.'
              : code === 'SUPER_ADMIN_PROTECTED'
                ? "Super admins can't be deactivated or removed here."
                : 'Could not update that Admin.',
        'error',
      );
    } finally {
      setBusyId(null);
    }
  }
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
            {admins.map((admin) => {
              const isMe = admin.id === account?.id;
              // Actions only for super admins, never on yourself or another super admin
              // (the backend enforces the same rules).
              const canManage = amSuperAdmin && !isMe && !admin.isSuperAdmin;
              const name = admin.name ?? admin.email;
              return (
                <li key={admin.id} className="px-4 py-2.5">
                  {confirming?.id === admin.id ? (
                    <div className="flex flex-col gap-2 rounded-md bg-warning/10 px-2 py-2">
                      <p className="text-sm font-bold text-text-body">
                        {confirming.action === 'remove'
                          ? `Remove ${name}? They'll lose access for good.`
                          : `Deactivate ${name}? They won't be able to sign in until reactivated.`}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" tone="red" disabled={busyId === admin.id} onClick={() => act(admin, confirming.action)}>
                          {confirming.action === 'remove' ? 'Remove' : 'Deactivate'}
                        </Button>
                        <Button variant="secondary" size="sm" disabled={busyId === admin.id} onClick={() => setConfirming(null)}>
                          Keep
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        aria-expanded={expandedId === admin.id}
                        onClick={() => setExpandedId((open) => (open === admin.id ? null : admin.id))}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 shrink-0 rounded-full ${admin.active ? 'bg-brand-primary' : 'bg-border-strong/40'}`}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-text-heading">
                            {name}
                            {isMe && <span className="font-medium text-text-secondary"> (you)</span>}
                          </span>
                          <span className="block truncate text-xs text-text-secondary">
                            {admin.active ? 'Active' : 'Inactive'}
                            {admin.isSuperAdmin && <span className="font-bold text-brand-secondary"> · Super admin</span>}
                          </span>
                        </span>
                      </button>
                      {/* The backend also keeps at least one Admin active at all times. */}
                      {canManage && (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === admin.id}
                            onClick={() => (admin.active ? setConfirming({ id: admin.id, action: 'deactivate' }) : act(admin, 'activate'))}
                          >
                            {admin.active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <button
                            type="button"
                            aria-label={`Remove ${name}`}
                            disabled={busyId === admin.id}
                            onClick={() => setConfirming({ id: admin.id, action: 'remove' })}
                            className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-b-[3px] border-error text-error"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {expandedId === admin.id && confirming?.id !== admin.id && <AdminDetails admin={admin} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AuditLogSection refreshKey={auditRefreshKey} />
    </AdminLayout>
  );
}
