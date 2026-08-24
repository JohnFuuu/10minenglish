import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import Header from '../components/Header'
import { upcomingLessons, pastLessons, notifications, type Lesson } from '../data/mockData'

export default function LessonsScreen() {
  const [tab, setTab] = useState<'upcoming' | 'previous'>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length
  const lessons = tab === 'upcoming' ? upcomingLessons : pastLessons

  return (
    <div className="min-h-screen pb-24" style={{ background: '#ffffff' }}>
      <Header title="My Lessons" />

      {/* Tabs */}
      <div className="flex px-5 gap-3 mt-4 mb-5">
        {(['upcoming', 'previous'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-3 font-bold text-xs uppercase tracking-widest"
            style={{
              borderRadius: 12,
              border: `2px solid ${tab === t ? '#58cc02' : '#e5e5e5'}`,
              borderBottom: `4px solid ${tab === t ? '#46a302' : '#e5e5e5'}`,
              background: tab === t ? '#58cc02' : '#ffffff',
              color: tab === t ? '#ffffff' : '#777777',
            }}
          >
            {t === 'upcoming' ? `UPCOMING (${upcomingLessons.length})` : 'PREVIOUS'}
          </button>
        ))}
      </div>

      <div className="px-5 flex flex-col gap-3">
        {lessons.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">📅</p>
            <p className="font-bold text-sm uppercase tracking-widest mb-1" style={{ color: '#042c60' }}>
              {tab === 'upcoming' ? 'No upcoming lessons' : 'No past lessons'}
            </p>
            <p className="font-medium text-sm mb-5" style={{ color: '#777777' }}>
              {tab === 'upcoming' ? 'Book a session with a Buddy.' : 'Completed lessons appear here.'}
            </p>
            {tab === 'upcoming' && (
              <button onClick={() => navigate('/buddies')} className="btn-primary px-8 py-3 text-sm font-bold">
                BROWSE BUDDIES
              </button>
            )}
          </div>
        ) : lessons.map((lesson) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            onCancel={tab === 'upcoming' ? () => setCancellingId(lesson.id) : undefined}
            onJoin={tab === 'upcoming' ? () => window.open(lesson.zoomLink, '_blank') : undefined}
          />
        ))}
      </div>

      {/* Cancel modal */}
      {cancellingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full p-6" style={{ background: '#ffffff', borderRadius: 16, maxWidth: 480 }}>
            <h3 className="font-bold text-lg uppercase tracking-widest mb-2" style={{ color: '#042c60' }}>Cancel lesson?</h3>
            <p className="font-medium text-sm mb-1" style={{ color: '#4b4b4b' }}>
              Cancel <strong>12+ hours before</strong> → automatic credit refund.
            </p>
            <p className="font-medium text-sm mb-6" style={{ color: '#4b4b4b' }}>
              Cancel <strong>less than 12 hours before</strong> → no refund.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancellingId(null)}
                className="flex-1 py-3.5 font-bold text-sm"
                style={{ border: '2px solid #3c3c3c', borderBottom: '4px solid #3c3c3c', borderRadius: 12, color: '#3c3c3c', letterSpacing: '0.05em' }}
              >
                KEEP LESSON
              </button>
              <button
                onClick={() => setCancellingId(null)}
                className="flex-1 py-3.5 font-bold text-sm"
                style={{ background: '#ff4b4b', border: '2px solid #cc0000', borderBottom: '4px solid #cc0000', borderRadius: 12, color: '#ffffff', letterSpacing: '0.05em' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav unreadCount={unread} />
    </div>
  )
}

function LessonCard({ lesson, onCancel, onJoin }: {
  lesson: Lesson; onCancel?: () => void; onJoin?: () => void
}) {
  const statusConfig = {
    upcoming: { label: 'UPCOMING', bg: '#d7ffb8', color: '#46a302', border: '#a5ed6e' },
    completed: { label: 'DONE', bg: '#e0f2fe', color: '#0284c7', border: '#7dd3fc' },
    cancelled: { label: 'CANCELLED', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  }
  const cfg = statusConfig[lesson.status]

  return (
    <div className="card-border p-4">
      <div className="flex items-center gap-3 mb-3">
        <img src={lesson.buddyAvatar} alt={lesson.buddyName} className="w-11 h-11 rounded-full object-cover" />
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: '#042c60' }}>{lesson.buddyName}</p>
          <p className="font-medium text-xs" style={{ color: '#777777' }}>{lesson.date} · {lesson.time}</p>
        </div>
        <span
          className="font-bold text-xs px-2.5 py-1 uppercase tracking-widest"
          style={{ background: cfg.bg, color: cfg.color, borderRadius: 12, border: `1px solid ${cfg.border}` }}
        >
          {cfg.label}
        </span>
      </div>

      {lesson.status === 'upcoming' && (
        <div className="flex gap-2">
          <button onClick={onJoin} className="btn-primary flex-1 py-3 text-sm font-bold">▶ JOIN</button>
          <button
            onClick={onCancel}
            className="px-4 py-3 font-bold text-sm"
            style={{ border: '2px solid #cc0000', borderBottom: '4px solid #cc0000', borderRadius: 12, color: '#dc2626', background: '#fff5f5', letterSpacing: '0.05em' }}
          >
            CANCEL
          </button>
        </div>
      )}

      {lesson.status === 'cancelled' && (
        <p className="font-medium text-xs" style={{ color: '#777777' }}>
          {lesson.creditsUsed === 0 ? '✓ 1 credit refunded' : 'No refund issued'}
        </p>
      )}
    </div>
  )
}
