import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { buddies, upcomingLessons } from '../data/mockData'

const buddy = buddies[0]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']
type AvailSlot = { day: string; time: string }

const defaultSlots: AvailSlot[] = [
  { day: 'Mon', time: '9:00 AM' }, { day: 'Mon', time: '10:00 AM' },
  { day: 'Wed', time: '10:00 AM' }, { day: 'Thu', time: '9:00 AM' }, { day: 'Fri', time: '3:00 PM' },
]

export default function BuddyDashboard() {
  const [zoomLink, setZoomLink] = useState(buddy.zoomLink)
  const [editingZoom, setEditingZoom] = useState(false)
  const [slots, setSlots] = useState<AvailSlot[]>(defaultSlots)
  const [activeTab, setActiveTab] = useState<'schedule' | 'availability' | 'profile'>('schedule')
  const [savedZoom, setSavedZoom] = useState(false)
  const navigate = useNavigate()

  const toggleSlot = (day: string, time: string) =>
    setSlots((prev) => prev.find((s) => s.day === day && s.time === time)
      ? prev.filter((s) => !(s.day === day && s.time === time))
      : [...prev, { day, time }])

  const isActive = (day: string, time: string) => slots.some((s) => s.day === day && s.time === time)

  return (
    <div className="min-h-screen pb-10" style={{ background: '#ffffff' }}>
      <Header
        title="Buddy Dashboard"
        showBack
        right={
          <button onClick={() => navigate('/dashboard')} className="font-bold text-xs uppercase tracking-widest" style={{ color: '#1cb0f6' }}>
            MEMBER
          </button>
        }
      />

      {/* Buddy banner */}
      <div className="mx-5 mt-4 mb-4 p-4" style={{ background: '#58cc02', borderRadius: 12, border: '2px solid #46a302', borderBottom: '5px solid #46a302' }}>
        <div className="flex items-center gap-3">
          <img src={buddy.avatar} alt={buddy.name} className="w-14 h-14 rounded-xl object-cover" style={{ border: '2px solid #d7ffb8' }} />
          <div>
            <p className="font-bold text-base" style={{ color: '#ffffff' }}>{buddy.name}</p>
            <p className="font-medium text-sm" style={{ color: '#d7ffb8' }}>★ {buddy.rating} · {buddy.totalLessons} lessons</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 rounded-full" style={{ background: buddy.active ? '#ffffff' : '#fee2e2' }} />
              <span className="font-bold text-xs uppercase tracking-widest" style={{ color: '#d7ffb8' }}>
                {buddy.active ? 'ACTIVE & BOOKABLE' : 'INACTIVE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* No Zoom warning */}
      {!zoomLink && (
        <div className="mx-5 mb-4 p-3 flex items-start gap-2" style={{ background: '#fff3cd', border: '2px solid #ffd700', borderRadius: 12 }}>
          <span>⚠️</span>
          <p className="font-bold text-xs uppercase tracking-widest" style={{ color: '#856404' }}>
            Add a Zoom link — members cannot book without it.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex px-5 gap-2 mb-5">
        {(['schedule', 'availability', 'profile'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className="flex-1 py-2.5 font-bold text-xs uppercase tracking-widest"
            style={{
              borderRadius: 12,
              border: `2px solid ${activeTab === t ? '#58cc02' : '#e5e5e5'}`,
              borderBottom: `3px solid ${activeTab === t ? '#46a302' : '#e5e5e5'}`,
              background: activeTab === t ? '#58cc02' : '#ffffff',
              color: activeTab === t ? '#ffffff' : '#777777',
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="px-5">
        {/* Schedule */}
        {activeTab === 'schedule' && (
          <>
            <p className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#777777' }}>Upcoming lessons</p>
            {upcomingLessons.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-4xl mb-2">🗓</p>
                <p className="font-bold text-sm uppercase tracking-widest" style={{ color: '#777777' }}>No upcoming lessons</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {upcomingLessons.map((lesson) => (
                  <div key={lesson.id} className="card-border p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base" style={{ background: '#d7ffb8', border: '2px solid #a5ed6e', color: '#46a302' }}>
                        ML
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: '#042c60' }}>Mei Lin</p>
                        <p className="font-medium text-xs" style={{ color: '#777777' }}>{lesson.date} · {lesson.time}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => window.open(lesson.zoomLink, '_blank')} className="btn-primary flex-1 py-3 text-sm font-bold">▶ START</button>
                      <button className="px-4 py-3 font-bold text-sm" style={{ border: '2px solid #cc0000', borderBottom: '4px solid #cc0000', borderRadius: 12, color: '#dc2626', background: '#fff5f5', letterSpacing: '0.05em' }}>CANCEL</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Availability */}
        {activeTab === 'availability' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-xs uppercase tracking-widest" style={{ color: '#777777' }}>Weekly availability</p>
              <span className="font-bold text-xs" style={{ color: '#1cb0f6' }}>{buddy.timezone}</span>
            </div>
            <p className="font-medium text-xs mb-4" style={{ color: '#777777' }}>Tap to toggle slots. Members can only book active slots.</p>

            <div className="overflow-x-auto -mx-5 px-5 pb-2">
              <div className="min-w-max">
                <div className="flex gap-1 mb-1.5">
                  <div className="w-20" />
                  {DAYS.map((d) => (
                    <div key={d} className="w-10 text-center font-bold text-xs uppercase tracking-widest" style={{ color: '#777777' }}>{d}</div>
                  ))}
                </div>
                {TIMES.map((time) => {
                  const [hm, period] = time.split(' ')
                  return (
                  <div key={time} className="flex gap-1 mb-1">
                    <div className="w-20 flex-shrink-0 text-right pr-3 flex flex-col justify-center" style={{ height: 36 }}>
                      <span className="font-bold leading-none" style={{ fontSize: 11, color: '#3c3c3c' }}>{hm}</span>
                      <span className="font-medium leading-none mt-0.5" style={{ fontSize: 10, color: '#afafaf' }}>{period}</span>
                    </div>
                    {DAYS.map((day) => {
                      const active = isActive(day, time)
                      return (
                        <button
                          key={day}
                          onClick={() => toggleSlot(day, time)}
                          className="w-10 h-9"
                          style={{
                            borderRadius: 8,
                            border: `2px solid ${active ? '#58cc02' : '#e5e5e5'}`,
                            borderBottom: `3px solid ${active ? '#46a302' : '#e5e5e5'}`,
                            background: active ? '#58cc02' : '#ffffff',
                          }}
                        />
                      )
                    })}
                  </div>
                )})}
              </div>
            </div>
            <p className="font-bold text-xs uppercase tracking-widest mt-3 text-center" style={{ color: '#777777' }}>
              {slots.length} slot{slots.length !== 1 ? 's' : ''} active
            </p>
          </>
        )}

        {/* Profile */}
        {activeTab === 'profile' && (
          <>
            {savedZoom && (
              <div className="mb-4 p-3 flex items-center gap-2" style={{ background: '#d7ffb8', border: '2px solid #a5ed6e', borderRadius: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#46a302" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="font-bold text-sm uppercase tracking-widest" style={{ color: '#46a302' }}>Zoom link saved!</p>
              </div>
            )}

            <p className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#777777' }}>Zoom link</p>
            {editingZoom ? (
              <div className="flex flex-col gap-2 mb-5">
                <input
                  type="url"
                  value={zoomLink}
                  onChange={(e) => setZoomLink(e.target.value)}
                  placeholder="https://zoom.us/j/yourlink"
                  className="w-full px-4 py-3.5 text-sm font-medium outline-none"
                  style={{ border: '2px solid #1cb0f6', borderBottom: '3px solid #1cb0f6', borderRadius: 12, fontFamily: 'Nunito, sans-serif', color: '#3c3c3c', background: '#ffffff' }}
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditingZoom(false)} className="flex-1 py-3 font-bold text-sm" style={{ border: '2px solid #e5e5e5', borderBottom: '3px solid #e5e5e5', borderRadius: 12, color: '#777777', letterSpacing: '0.05em' }}>CANCEL</button>
                  <button onClick={() => { setEditingZoom(false); setSavedZoom(true); setTimeout(() => setSavedZoom(false), 2000) }} className="btn-primary flex-1 py-3 text-sm font-bold">SAVE</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 mb-5 card-border">
                <span className="flex-1 text-sm font-medium truncate" style={{ color: zoomLink ? '#3c3c3c' : '#777777' }}>
                  {zoomLink || 'No Zoom link set'}
                </span>
                <button onClick={() => setEditingZoom(true)} className="font-bold text-xs uppercase tracking-widest" style={{ color: '#58cc02' }}>EDIT</button>
              </div>
            )}

            <p className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#777777' }}>Topics</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {buddy.topics.map((t) => (
                <span key={t} className="font-bold text-xs px-3 py-1.5 uppercase tracking-widest" style={{ background: '#d7ffb8', color: '#46a302', borderRadius: 12, border: '1px solid #a5ed6e' }}>
                  {t}
                </span>
              ))}
            </div>

            <p className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: '#777777' }}>Bio</p>
            <div className="p-4 font-medium text-sm leading-relaxed card-border" style={{ color: '#4b4b4b' }}>
              {buddy.bio}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
