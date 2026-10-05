import { Account } from '../models/Account.js';
import { AuditEntry, type AuditAction, type AuditTargetType } from '../models/AuditEntry.js';

export interface AuditTarget {
  type: AuditTargetType;
  id?: string;
  label: string;
}

// How the log names a member, Buddy, or Admin.
export function accountLabel(account: { name?: string; email?: string }): string {
  return account.name ?? account.email ?? 'Unknown account';
}

// Records one Admin change. Call it after the change has succeeded. Never
// throws: a failed write is reported in the server log rather than undoing
// the Admin's change (no MongoDB transactions in this deployment).
export async function recordAdminAction(
  adminId: string,
  action: AuditAction,
  target: AuditTarget,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    const admin = await Account.findById(adminId, { name: 1, email: 1 });
    await AuditEntry.create({
      action,
      admin: { id: adminId, name: admin ? accountLabel(admin) : 'Removed admin' },
      target,
      details,
    });
  } catch (err) {
    console.error(`Audit log write failed for ${action}`, err);
  }
}
