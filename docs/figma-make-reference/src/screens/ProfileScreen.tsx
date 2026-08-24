import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { currentUser, notifications, buddies, pastLessons, upcomingLessons } from '../data/mockData'

const AVATAR = 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&auto=format'

const achievements = [
  { icon: '🎯', label: 'First Booking', earned: true },
  { icon: '🔥', label: '3-Day Streak', earned: true },
  { icon: '💬', label: '5 Lessons', earned: true },
  { icon: '⭐', label: 'Top Member', earned: false },
  { icon: '🏆', label: '10 Lessons', earned: false },
  { icon: '🌟', label: 'Fluent Month', earned: false },
]

const allLessons = [...upcomingLessons, ...pastLessons]
const favBuddies = buddies.filter((b) => ['b1', 'b3'].includes(b.id))
const unread = notifications.filter((n) => !n.read).length

export default function ProfileScreen() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen pb-36" style={{ background: '#ffffff' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3" style={{ borderBottom: '1.5px solid #e5e5e5' }}>
        <div className="w-9" />
        <h1 className="font-bold" style={{ fontSize: 17, color: '#777777', fontFamily: 'Nunito, sans-serif', letterSpacing: '0.04em' }}>
          Profile
        </h1>
        <button onClick={() => navigate('/admin')} className="w-9 h-9 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#777777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Avatar + user info */}
      <div className="px-5 pt-5 pb-5" style={{ borderBottom: '1.5px solid #e5e5e5' }}>
        <div className="flex items-center gap-4 mb-4">
          <img
            src={AVATAR}
            alt={currentUser.name}
            className="object-cover flex-shrink-0"
            style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid #e5e5e5' }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold" style={{ fontSize: 22, color: '#3c3c3c', fontFamily: 'Nunito, sans-serif', lineHeight: 1.2 }}>
              {currentUser.name}
            </p>
            <p className="font-medium" style={{ fontSize: 14, color: '#afafaf', marginTop: 2 }}>
              MEI747872
            </p>
            <p className="font-medium" style={{ fontSize: 14, color: '#3c3c3c', marginTop: 2 }}>
              Joined November 2024 &nbsp;🇳🇿
            </p>
          </div>
        </div>
        <button className="font-bold" style={{ fontSize: 15, color: '#1cb0f6' }}>
          {favBuddies.length} Favourite Buddies
        </button>
      </div>

      {/* Statistics */}
      <div className="px-5 pt-5 pb-4">
        <h2 className="font-bold mb-4" style={{ fontSize: 22, color: '#3c3c3c', fontFamily: 'Nunito, sans-serif' }}>
          Statistics
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<span style={{ fontSize: 22 }}>🔥</span>}
            value="3"
            label="Day streak"
          />
          <StatCard
            icon={<span style={{ fontSize: 22 }}>💎</span>}
            value={String(currentUser.credits)}
            label="Credits left"
          />
          <StatCard
            icon={<LevelIcon level={2} />}
            value="Level 2"
            label="Current level"
          />
          <StatCard
            icon={<span style={{ fontSize: 22 }}>📅</span>}
            value={String(allLessons.length)}
            label="Total sessions"
          />
        </div>
      </div>

      <Divider />

      {/* Achievements */}
      <div className="px-5 pt-4 pb-4">
        <h2 className="font-bold mb-4" style={{ fontSize: 22, color: '#3c3c3c', fontFamily: 'Nunito, sans-serif' }}>
          Achievements
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {achievements.map((a) => (
            <div
              key={a.label}
              className="flex flex-col items-center gap-1.5 py-3 px-2"
              style={{
                borderRadius: 14,
                border: `2px solid ${a.earned ? '#a5ed6e' : '#e5e5e5'}`,
                background: a.earned ? '#f0fde4' : '#fafafa',
                opacity: a.earned ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: 26, filter: a.earned ? 'none' : 'grayscale(1)' }}>{a.icon}</span>
              <span className="font-bold text-center" style={{ fontSize: 11, color: a.earned ? '#46a302' : '#afafaf', letterSpacing: '0.03em', lineHeight: 1.3 }}>
                {a.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* Session history */}
      <div className="px-5 pt-4 pb-4">
        <h2 className="font-bold mb-4" style={{ fontSize: 22, color: '#3c3c3c', fontFamily: 'Nunito, sans-serif' }}>
          Session History
        </h2>
        <div className="flex flex-col gap-0" style={{ border: '2px solid #e5e5e5', borderRadius: 14, overflow: 'hidden' }}>
          {allLessons.map((lesson, i) => {
            const statusColor = lesson.status === 'upcoming' ? '#58cc02' : lesson.status === 'cancelled' ? '#ff4b4b' : '#afafaf'
            const statusLabel = lesson.status === 'upcoming' ? 'Upcoming' : lesson.status === 'cancelled' ? 'Cancelled' : 'Done'
            return (
              <div
                key={lesson.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? '1.5px solid #e5e5e5' : 'none', background: '#ffffff' }}
              >
                <img src={lesson.buddyAvatar} alt={lesson.buddyName} className="object-cover flex-shrink-0" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate" style={{ fontSize: 14, color: '#3c3c3c' }}>{lesson.buddyName}</p>
                  <p className="font-medium" style={{ fontSize: 12, color: '#afafaf' }}>{lesson.date} · {lesson.time}</p>
                </div>
                <span className="font-bold" style={{ fontSize: 11, color: statusColor, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {statusLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <Divider />

      {/* Favourite buddies */}
      <div className="px-5 pt-4 pb-4">
        <h2 className="font-bold mb-4" style={{ fontSize: 22, color: '#3c3c3c', fontFamily: 'Nunito, sans-serif' }}>
          Favourite Buddies
        </h2>
        <div className="flex flex-col gap-3">
          {favBuddies.map((buddy) => (
            <div
              key={buddy.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ border: '2px solid #e5e5e5', borderBottom: '3px solid #e5e5e5', borderRadius: 14, background: '#ffffff' }}
            >
              <img src={buddy.avatar} alt={buddy.name} className="object-cover flex-shrink-0" style={{ width: 44, height: 44, borderRadius: '50%' }} />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate" style={{ fontSize: 15, color: '#3c3c3c' }}>{buddy.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span style={{ fontSize: 12, color: '#ffd700' }}>★</span>
                  <span className="font-bold" style={{ fontSize: 12, color: '#3c3c3c' }}>{buddy.rating}</span>
                  <span className="font-medium" style={{ fontSize: 12, color: '#afafaf' }}>· {buddy.totalLessons} lessons</span>
                </div>
              </div>
              <span style={{ fontSize: 18, color: '#ff4b4b' }}>♥</span>
            </div>
          ))}
        </div>
      </div>

      {/* Log out */}
      <div className="px-5 pb-6">
        <button
          onClick={() => {}}
          className="w-full font-bold uppercase"
          style={{
            height: 52,
            borderRadius: 14,
            border: '2px solid #e5e5e5',
            borderBottom: '3px solid #e5e5e5',
            background: '#ffffff',
            fontSize: 14,
            color: '#ff4b4b',
            letterSpacing: '0.07em',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          Log Out
        </button>
      </div>

      <BottomNav unreadCount={unread} />
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1.5px', background: '#e5e5e5', margin: '0 20px' }} />
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-4"
      style={{ border: '2px solid #e5e5e5', borderRadius: 14, background: '#ffffff' }}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="font-bold" style={{ fontSize: 18, color: '#3c3c3c', lineHeight: 1.1 }}>{value}</p>
        <p className="font-medium" style={{ fontSize: 12, color: '#afafaf', marginTop: 2 }}>{label}</p>
      </div>
    </div>
  )
}

function LevelIcon({ level }: { level: number }) {
  const colors = ['', '#58cc02', '#1cb0f6', '#ff9600', '#a560f8', '#ff4b4b']
  const color = colors[level] || '#58cc02'
  return (
    <div
      className="flex items-center justify-center font-bold"
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: color,
        color: '#ffffff',
        fontSize: 13,
        fontFamily: 'Nunito, sans-serif',
      }}
    >
      {level}
    </div>
  )
}
