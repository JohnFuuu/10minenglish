import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { currentUser, upcomingLessons, notifications } from '../data/mockData'

export default function DashboardScreen() {
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length
  const nextLesson = upcomingLessons[0]

  return (
    <div className="min-h-screen pb-36" style={{ background: '#ffffff' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4" style={{ borderBottom: '2px solid #e5e5e5' }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦉</span>
          <span
            className="font-bold"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 18, color: '#58cc02', letterSpacing: '-0.01em' }}
          >
            10ME
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Streak */}
          <div className="flex items-center gap-1 px-3 py-1.5 font-bold text-sm" style={{ border: '2px solid #e5e5e5', borderBottom: '3px solid #e5e5e5', borderRadius: 12, color: '#ff9600' }}>
            🔥 <span style={{ color: '#3c3c3c' }}>3</span>
          </div>
          {/* Credits */}
          <div className="flex items-center gap-1 px-3 py-1.5 font-bold text-sm" style={{ border: '2px solid #a5ed6e', borderBottom: '3px solid #a5ed6e', borderRadius: 12, color: '#58cc02' }}>
            💎 <span>{currentUser.credits}</span>
          </div>
          {/* Notifications */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative w-9 h-9 flex items-center justify-center"
            style={{ border: '2px solid #e5e5e5', borderBottom: '3px solid #e5e5e5', borderRadius: 12 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3c3c3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold" style={{ background: '#ff4b4b', fontSize: 9 }}>
                {unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-5 pt-5 pb-4">
        <p className="font-bold text-sm uppercase tracking-widest" style={{ color: '#777777' }}>
          Good morning,
        </p>
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 900,
            fontSize: 28,
            color: '#042c60',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          {currentUser.name.split(' ')[0]}! 👋
        </h1>
      </div>

      {/* Buddy mode entry — only shown if user is on the buddy list */}
      {currentUser.isBuddy && (
        <div className="mx-5 mb-4 flex items-center gap-3 px-4 py-3" style={{ borderRadius: 12, border: '2px solid #1cb0f6', borderBottom: '4px solid #18a0dc', background: '#e0f7ff' }}>
          {/* Cartoon owl badge */}
          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 10, background: '#1cb0f6', border: '2px solid #18a0dc' }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              {/* Simple owl: body */}
              <ellipse cx="13" cy="16" rx="8" ry="7" fill="#ffffff" opacity="0.9" />
              {/* Eyes */}
              <circle cx="10" cy="12" r="3.5" fill="#ffffff" />
              <circle cx="16" cy="12" r="3.5" fill="#ffffff" />
              <circle cx="10" cy="12" r="2" fill="#18a0dc" />
              <circle cx="16" cy="12" r="2" fill="#18a0dc" />
              <circle cx="10.8" cy="11.2" r="0.7" fill="#ffffff" />
              <circle cx="16.8" cy="11.2" r="0.7" fill="#ffffff" />
              {/* Beak */}
              <polygon points="13,13.5 11.5,15.5 14.5,15.5" fill="#ff9600" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: '#042c60', letterSpacing: '0.02em' }}>You're a Buddy!</p>
            <p className="font-medium text-xs" style={{ color: '#1cb0f6' }}>Switch to manage your schedule</p>
          </div>
          <button
            onClick={() => navigate('/buddy-dashboard')}
            className="font-bold text-xs uppercase tracking-widest px-3 py-2 flex-shrink-0"
            style={{ borderRadius: 10, background: '#1cb0f6', border: '2px solid #18a0dc', borderBottom: '3px solid #18a0dc', color: '#ffffff', letterSpacing: '0.05em' }}
          >
            SWITCH
          </button>
        </div>
      )}

      {/* Credits streak banner */}
      <div className="mx-5 mb-5 p-4" style={{ background: '#58cc02', borderRadius: 12, border: '2px solid #46a302', borderBottom: '5px solid #46a302' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-xs uppercase tracking-widest" style={{ color: '#d7ffb8' }}>Your credits</p>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 900,
                fontSize: 40,
                color: '#ffffff',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {currentUser.credits}
            </p>
            <p className="font-bold text-xs" style={{ color: '#d7ffb8' }}>lessons available</p>
          </div>
          <button
            onClick={() => navigate('/credits')}
            className="px-5 py-3 font-bold text-sm"
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '2px solid #d7ffb8',
              borderBottom: '4px solid #d7ffb8',
              color: '#58cc02',
              letterSpacing: '0.05em',
            }}
          >
            TOP UP
          </button>
        </div>
      </div>

      {/* Next lesson */}
      {nextLesson && (
        <div className="px-5 mb-5">
          <p className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#777777' }}>Next lesson</p>
          <div className="p-4 card-border">
            <div className="flex items-center gap-3 mb-3">
              <img src={nextLesson.buddyAvatar} alt={nextLesson.buddyName} className="w-12 h-12 rounded-full object-cover" style={{ border: '2px solid #a5ed6e' }} />
              <div className="flex-1">
                <p className="font-bold text-base" style={{ color: '#042c60', letterSpacing: '0.03em' }}>{nextLesson.buddyName}</p>
                <p className="font-medium text-sm" style={{ color: '#777777' }}>{nextLesson.date} · {nextLesson.time}</p>
              </div>
              <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#58cc02' }} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.open(nextLesson.zoomLink, '_blank')}
                className="btn-primary flex-1 py-3 text-sm font-bold"
              >
                ▶ JOIN NOW
              </button>
              <button
                onClick={() => navigate('/lessons')}
                className="btn-outline px-4 py-3 text-sm font-bold"
              >
                DETAILS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-5 mb-5">
        <p className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#777777' }}>Quick actions</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'BOOK A LESSON', icon: '📅', path: '/buddies' },
            { label: 'BROWSE BUDDIES', icon: '👥', path: '/buddies' },
            { label: 'MY LESSONS', icon: '🗓', path: '/lessons' },
            { label: 'BUY CREDITS', icon: '💎', path: '/credits' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-start p-4 text-left"
              style={{
                borderRadius: 12,
                border: '2px solid #3c3c3c',
                borderBottom: '4px solid #3c3c3c',
                background: '#ffffff',
              }}
            >
              <span className="text-2xl mb-2">{action.icon}</span>
              <span className="font-bold text-xs tracking-widest" style={{ color: '#042c60' }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-xs uppercase tracking-widest" style={{ color: '#777777' }}>Upcoming</p>
          <button onClick={() => navigate('/lessons')} className="font-bold text-xs" style={{ color: '#1cb0f6', letterSpacing: '0.05em' }}>
            SEE ALL →
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {upcomingLessons.map((lesson) => (
            <div key={lesson.id} className="flex items-center gap-3 p-3" style={{ borderRadius: 12, border: '2px solid #e5e5e5', borderBottom: '3px solid #e5e5e5', background: '#ffffff' }}>
              <img src={lesson.buddyAvatar} alt={lesson.buddyName} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1">
                <p className="font-bold text-sm" style={{ color: '#042c60' }}>{lesson.buddyName}</p>
                <p className="font-medium text-xs" style={{ color: '#777777' }}>{lesson.date} · {lesson.time}</p>
              </div>
              <span className="font-bold text-xs px-2.5 py-1" style={{ background: '#d7ffb8', color: '#46a302', borderRadius: 12, letterSpacing: '0.05em' }}>
                UPCOMING
              </span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav unreadCount={unread} />
    </div>
  )
}
