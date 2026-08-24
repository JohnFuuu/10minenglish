import { useState } from 'react'
import BottomNav from '../components/BottomNav'
import Header from '../components/Header'
import { notifications as initialNotifs, type Notification } from '../data/mockData'

// Flat cartoon SVG icons — one per notification type
const iconConfig: Record<Notification['type'], { bg: string; icon: React.ReactNode }> = {
  reminder: {
    bg: '#fff3cd',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {/* Clock face */}
        <circle cx="12" cy="12" r="9" fill="#ff9600" />
        <circle cx="12" cy="12" r="7" fill="#ffffff" />
        {/* Clock hands */}
        <line x1="12" y1="12" x2="12" y2="7" stroke="#ff9600" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="12" y1="12" x2="16" y2="14" stroke="#ff9600" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1.2" fill="#ff9600" />
      </svg>
    ),
  },
  booking: {
    bg: '#d7ffb8',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {/* Calendar */}
        <rect x="3" y="5" width="18" height="16" rx="3" fill="#58cc02" />
        <rect x="3" y="5" width="18" height="6" rx="3" fill="#46a302" />
        {/* Binding dots */}
        <rect x="8" y="3" width="2.5" height="4" rx="1.2" fill="#3c3c3c" />
        <rect x="13.5" y="3" width="2.5" height="4" rx="1.2" fill="#3c3c3c" />
        {/* Check */}
        <polyline points="8,15 11,18 16,12" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  cancellation: {
    bg: '#fee2e2',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {/* Circle */}
        <circle cx="12" cy="12" r="9" fill="#ff4b4b" />
        {/* X */}
        <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="15.5" y1="8.5" x2="8.5" y2="15.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  credit: {
    bg: '#e0f7ff',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {/* Diamond shape */}
        <polygon points="12,3 20,10 12,21 4,10" fill="#1cb0f6" />
        <polygon points="12,3 20,10 12,14 4,10" fill="#18a0dc" />
        {/* Shine */}
        <line x1="10" y1="7" x2="8" y2="10" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      </svg>
    ),
  },
  system: {
    bg: '#f0f0f0',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {/* Circle */}
        <circle cx="12" cy="12" r="9" fill="#afafaf" />
        {/* i */}
        <circle cx="12" cy="8" r="1.2" fill="#ffffff" />
        <rect x="11" y="11" width="2" height="6" rx="1" fill="#ffffff" />
      </svg>
    ),
  },
}

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState(initialNotifs)
  const unread = notifs.filter((n) => !n.read).length

  const markAllRead = () => setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  const markRead = (id: string) => setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))

  return (
    <div className="min-h-screen pb-24" style={{ background: '#ffffff' }}>
      <Header
        title={unread > 0 ? `Alerts (${unread})` : 'Alerts'}
        right={
          unread > 0 ? (
            <button onClick={markAllRead} className="font-bold text-xs uppercase tracking-widest" style={{ color: '#58cc02' }}>
              ALL READ
            </button>
          ) : undefined
        }
      />

      <div className="px-5 mt-4 flex flex-col gap-2">
        {notifs.length === 0 ? (
          <div className="text-center py-16">
            {/* Empty state owl */}
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto mb-4">
              <circle cx="32" cy="32" r="28" fill="#f0f0f0" />
              {/* Owl body suggestion */}
              <ellipse cx="32" cy="38" rx="14" ry="12" fill="#d0d0d0" />
              <circle cx="26" cy="28" r="7" fill="#d0d0d0" />
              <circle cx="38" cy="28" r="7" fill="#d0d0d0" />
              <circle cx="26" cy="28" r="4" fill="#ffffff" />
              <circle cx="38" cy="28" r="4" fill="#ffffff" />
              <circle cx="27" cy="28" r="2" fill="#c0c0c0" />
              <circle cx="39" cy="28" r="2" fill="#c0c0c0" />
            </svg>
            <p className="font-bold text-sm uppercase tracking-widest" style={{ color: '#afafaf' }}>All caught up!</p>
          </div>
        ) : notifs.map((notif) => {
          const cfg = iconConfig[notif.type]
          return (
            <button
              key={notif.id}
              onClick={() => markRead(notif.id)}
              className="flex items-start gap-3 p-4 text-left w-full"
              style={{
                borderRadius: 14,
                border: `2px solid ${notif.read ? '#e5e5e5' : '#a5ed6e'}`,
                borderBottom: `3px solid ${notif.read ? '#e5e5e5' : '#a5ed6e'}`,
                background: notif.read ? '#ffffff' : '#f0fde4',
              }}
            >
              {/* Cartoon icon tile */}
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: cfg.bg,
                  border: '2px solid #e5e5e5',
                }}
              >
                {cfg.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm leading-snug" style={{ color: '#3c3c3c' }}>
                    {notif.title}
                  </p>
                  {!notif.read && (
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: '#58cc02' }} />
                  )}
                </div>
                <p className="font-medium text-xs mt-1 leading-relaxed" style={{ color: '#777777' }}>
                  {notif.body}
                </p>
                <p className="font-bold text-xs mt-1.5 uppercase tracking-widest" style={{ color: '#afafaf' }}>
                  {notif.timestamp}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <BottomNav unreadCount={unread} />
    </div>
  )
}
