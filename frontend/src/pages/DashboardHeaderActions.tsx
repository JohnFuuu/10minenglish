import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CircleQuestionMark } from 'lucide-react';
import { Button, Modal } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useUnreadCount } from '../lib/useUnreadCount';
import { MessagesPanel } from './NotificationsScreen';
import { HelpPanel } from './support/SupportScreen';

const HEADER_BUTTON =
  'relative flex h-9 w-9 items-center justify-center rounded-md border-2 border-b-[3px] border-border';

type OpenPopup = { kind: 'help'; ticketId: string | null } | { kind: 'messages' } | null;

// The Help (?) and Messages (bell) buttons at the top of the User and Buddy
// dashboards. Both open as pop-ups over the dashboard. Messages shows only
// unread ones, with "Manage all messages" going to the full /notifications page.
export function DashboardHeaderActions() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useUnreadCount(token);
  const [popup, setPopup] = useState<OpenPopup>(null);
  const navigate = useNavigate();

  return (
    <>
      <button type="button" aria-label="Help" onClick={() => setPopup({ kind: 'help', ticketId: null })} className={HEADER_BUTTON}>
        <CircleQuestionMark size={18} color="#3c3c3c" strokeWidth={2.5} />
      </button>
      <button type="button" aria-label="Messages" onClick={() => setPopup({ kind: 'messages' })} className={HEADER_BUTTON}>
        <Bell size={18} color="#3c3c3c" strokeWidth={2.5} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[9px] font-bold text-text-inverse">
            {unreadCount}
          </span>
        )}
      </button>

      {popup?.kind === 'help' && (
        <Modal title="Help" onClose={() => setPopup(null)}>
          <HelpPanel initialOpenId={popup.ticketId} />
        </Modal>
      )}

      {popup?.kind === 'messages' && (
        <Modal title={unreadCount > 0 ? `Messages (${unreadCount})` : 'Messages'} onClose={() => setPopup(null)}>
          <MessagesPanel
            unreadOnly
            onOpenTicket={(ticketId) => setPopup({ kind: 'help', ticketId })}
            onUnreadCountChange={setUnreadCount}
          />
          <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate('/notifications')}>
            Manage all messages
          </Button>
        </Modal>
      )}
    </>
  );
}
