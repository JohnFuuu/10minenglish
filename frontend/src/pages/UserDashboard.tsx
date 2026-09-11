import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, CalendarDays, CalendarX, ChevronDown, ChevronUp, Gem, Receipt, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Avatar, BottomNav, Button, Card, Modal, NAV_CLEARANCE_CLASS } from '../components';
import {
  fetchNotifications,
  fetchPaymentHistory,
  fetchUserLessons,
  type LessonWithBuddy,
  type PaymentHistoryEntry,
} from '../lib/api';
import { formatDateTime } from '../lib/formatDateTime';
import { initialsOf } from '../lib/initials';

const PAYMENT_STATUS_STYLE: Record<PaymentHistoryEntry['status'], string> = {
  succeeded: 'bg-success-bg text-success',
  pending: 'bg-warning/10 text-warning',
  failed: 'bg-error/10 text-error',
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const COLLAPSED_HISTORY_COUNT = 5;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function UserDashboard() {
  const { account, token } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcoming, setUpcoming] = useState<LessonWithBuddy[] | null>(null);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[] | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
    fetchUserLessons(token).then((res) => setUpcoming(res.upcoming));
  }, [token]);

  useEffect(() => {
    if (!isWalletOpen || !token) return;
    fetchPaymentHistory(token).then((res) => setPaymentHistory(res.payments));
  }, [isWalletOpen, token]);

  const hasCredits = (account?.credits ?? 0) > 0;
  const [nextLesson, ...restUpcoming] = upcoming ?? [];

  const quickActions = [
    { label: 'BOOK A LESSON', icon: Calendar, path: hasCredits ? '/book' : '/credits' },
    { label: 'BUDDIES', icon: Users, path: '/buddies' },
    { label: 'MY LESSONS', icon: CalendarDays, path: '/lessons' },
    { label: 'BUY CREDITS', icon: Gem, path: '/credits' },
  ] as const;

  return (
    <main className={`mx-auto max-w-3xl ${NAV_CLEARANCE_CLASS}`}>
      <div className="flex items-center justify-between border-b-2 border-border px-5 pb-4 pt-8">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-11 w-11" />
          <span className="font-display text-xl font-black text-brand-primary">10ME</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsHistoryExpanded(false);
              setIsWalletOpen(true);
            }}
            className="flex items-center gap-1 rounded-md border-2 border-b-[3px] border-accent-lime px-3 py-1.5 text-sm font-bold text-brand-primary"
          >
            <Gem size={14} /> {account?.credits ?? 0}
          </button>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="relative flex h-9 w-9 items-center justify-center rounded-md border-2 border-b-[3px] border-border"
          >
            <Bell size={18} color="#3c3c3c" strokeWidth={2.5} />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[9px] font-bold text-text-inverse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-5 pb-4 pt-5">
        <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">{greeting()},</p>
        <h1 className="font-display text-3xl font-black text-text-heading">
          {account?.name?.split(' ')[0] ?? 'there'}!
        </h1>
      </div>

      <div className="mx-5 mb-5 rounded-md border-2 border-b-[5px] border-brand-primary-border bg-brand-primary p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent-lime-light">Your credits</p>
            <p className="font-display text-4xl font-black text-text-inverse">{account?.credits ?? 0}</p>
            <p className="text-xs font-bold text-accent-lime-light">lessons available</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/credits')}
            className="rounded-md border-2 border-b-4 border-accent-lime-light bg-bg-surface px-5 py-3 text-sm font-bold text-brand-primary"
          >
            TOP UP
          </button>
        </div>
      </div>

      {nextLesson && (
        <div className="mb-5 px-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Next lesson</p>
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <Avatar initials={initialsOf(nextLesson.buddyName)} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text-heading">{nextLesson.buddyName}</p>
                <p className="text-sm text-text-secondary">{formatDateTime(nextLesson.startTime)}</p>
              </div>
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-brand-primary" />
            </div>
            <div className="flex gap-2">
              {nextLesson.joinable && nextLesson.zoomLink.startsWith('https://') && (
                <Button
                  className="flex-1"
                  onClick={() => window.open(nextLesson.zoomLink, '_blank', 'noopener')}
                >
                  ▶ Join now
                </Button>
              )}
              <Button
                variant="secondary"
                className={nextLesson.joinable ? '' : 'flex-1'}
                onClick={() => navigate('/lessons')}
              >
                Details
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="mb-5 px-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Quick actions</p>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.path)}
              className="flex flex-col items-start rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-4 text-left"
            >
              <action.icon className="mb-2 h-6 w-6 text-brand-primary" strokeWidth={2.5} />
              <span className="text-xs font-bold tracking-widest text-text-heading">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {restUpcoming.length > 0 && (
        <div className="px-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Upcoming</p>
            <button
              type="button"
              onClick={() => navigate('/lessons')}
              className="text-xs font-bold tracking-widest text-brand-secondary"
            >
              SEE ALL →
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {restUpcoming.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center gap-3 rounded-md border-2 border-b-[3px] border-border bg-bg-surface p-3"
              >
                <Avatar initials={initialsOf(lesson.buddyName)} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text-heading">{lesson.buddyName}</p>
                  <p className="text-xs text-text-secondary">{formatDateTime(lesson.startTime)}</p>
                </div>
                <span className="shrink-0 rounded-md bg-success-bg px-2.5 py-1 text-xs font-bold tracking-widest text-success">
                  UPCOMING
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcoming !== null && upcoming.length === 0 && (
        <div className="px-5 py-12 text-center">
          <CalendarX size={36} className="mx-auto mb-3 text-text-secondary" />
          <p className="mb-1 text-sm font-bold uppercase tracking-widest text-text-heading">No lessons booked</p>
          <p className="mb-5 text-sm text-text-secondary">Find a Buddy and book your first session.</p>
          <Button onClick={() => navigate('/buddies')}>Browse buddies</Button>
        </div>
      )}

      {isWalletOpen && (
        <Modal title="Your wallet" onClose={() => setIsWalletOpen(false)}>
          <div className="mb-5 rounded-md border-2 border-b-[3px] border-brand-primary-border bg-brand-primary p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-accent-lime-light">Current balance</p>
            <p className="font-display text-3xl font-black text-text-inverse">{account?.credits ?? 0}</p>
            <p className="text-xs font-bold text-accent-lime-light">lessons available</p>
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Top-up history</p>

          {paymentHistory === null && <p className="text-sm text-text-secondary">Loading…</p>}

          {paymentHistory !== null && paymentHistory.length === 0 && (
            <div className="py-8 text-center">
              <Receipt size={32} className="mx-auto mb-2 text-text-secondary" />
              <p className="text-sm text-text-secondary">No top-ups yet.</p>
            </div>
          )}

          {paymentHistory !== null && paymentHistory.length > 0 && (
            <div className="flex flex-col gap-2">
              {(isHistoryExpanded ? paymentHistory : paymentHistory.slice(0, COLLAPSED_HISTORY_COUNT)).map(
                (payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-md border-2 border-border bg-bg-page p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-text-heading">{payment.packSize} credits</p>
                      <p className="text-xs text-text-secondary">{formatDateTime(payment.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold text-text-body">
                        {formatPrice(payment.priceCentsAtPurchase)}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${PAYMENT_STATUS_STYLE[payment.status]}`}
                      >
                        {payment.status}
                      </span>
                    </div>
                  </div>
                ),
              )}

              {paymentHistory.length > COLLAPSED_HISTORY_COUNT && (
                <button
                  type="button"
                  onClick={() => setIsHistoryExpanded((current) => !current)}
                  className="mt-1 flex items-center justify-center gap-1 py-2 text-xs font-bold tracking-widest text-brand-secondary"
                >
                  {isHistoryExpanded ? (
                    <>
                      Show less <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      Show {paymentHistory.length - COLLAPSED_HISTORY_COUNT} more <ChevronDown size={14} />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </Modal>
      )}

      <BottomNav unreadCount={unreadCount} />
    </main>
  );
}
