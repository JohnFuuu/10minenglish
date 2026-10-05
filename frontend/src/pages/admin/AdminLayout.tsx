import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BottomNav, Button, NAV_CLEARANCE_CLASS } from '../../components';
import { useAuth } from '../../auth/AuthContext';

// Shared frame for every Admin tab: title + Log out on top, the Admin tab
// bar at the bottom. `liveChanges` shows the warning on tabs whose edits
// reach Users straight away (Buddies, Pricing).
export function AdminLayout({ title, liveChanges = false, children }: { title: string; liveChanges?: boolean; children: ReactNode }) {
  const { logout } = useAuth();

  return (
    <main className={`mx-auto max-w-lg px-5 pt-10 ${NAV_CLEARANCE_CLASS}`}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-text-heading">{title}</h1>
        <Button variant="secondary" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>

      {liveChanges && (
        <div className="mb-6 flex items-center gap-2 rounded-md border-2 border-warning bg-warning/10 px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 text-warning" />
          <p className="text-xs font-bold uppercase tracking-wide text-text-body">Changes take effect immediately</p>
        </div>
      )}

      {children}
      <BottomNav />
    </main>
  );
}
