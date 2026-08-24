import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  {
    path: '/dashboard',
    label: 'HOME',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#58cc02' : 'none'} stroke={active ? '#58cc02' : '#777777'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    path: '/buddies',
    label: 'BUDDIES',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#58cc02' : '#777777'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    path: '/lessons',
    label: 'LESSONS',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#58cc02' : '#777777'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    path: '/notifications',
    label: 'ALERTS',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#58cc02' : '#777777'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    path: '/profile',
    label: 'PROFILE',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#58cc02' : '#777777'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function BottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      style={{
        background: '#ffffff',
        borderTop: '2px solid #e5e5e5',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-3">
        {tabs.map((tab) => {
          const active = location.pathname.startsWith(tab.path)
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 relative"
            >
              <div className="relative">
                {tab.icon(active)}
                {tab.path === '/notifications' && unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: '#ff4b4b', fontSize: 9 }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <span
                className="font-bold"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: active ? '#58cc02' : '#777777',
                }}
              >
                {tab.label}
              </span>
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ background: '#58cc02' }} />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
