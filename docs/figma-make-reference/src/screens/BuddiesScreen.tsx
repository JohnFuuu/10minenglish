import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import Header from '../components/Header'
import { buddies, notifications, type Buddy } from '../data/mockData'

type Tab = 'all' | 'recent' | 'favourites'

export default function BuddiesScreen() {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [favs, setFavs] = useState<string[]>(['b3'])
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length

  const filtered = buddies.filter((b) => {
    if (tab === 'favourites') return favs.includes(b.id)
    if (tab === 'recent') return ['b1', 'b2'].includes(b.id)
    return true
  }).filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.topics.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  )

  const toggleFav = (id: string) =>
    setFavs((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id])

  return (
    <div className="min-h-screen pb-36" style={{ background: '#ffffff' }}>
      <Header title="Buddies" />

      {/* Search */}
      <div className="px-5 mt-4 mb-4">
        <div className="flex items-center gap-2 px-4 py-3" style={{ border: '2px solid #e5e5e5', borderBottom: '3px solid #e5e5e5', borderRadius: 12, background: '#ffffff' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#777777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or topic…"
            className="flex-1 text-sm font-medium bg-transparent outline-none"
            style={{ fontFamily: 'Nunito, sans-serif', color: '#3c3c3c', letterSpacing: '0.03em' }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-5 gap-2 mb-5">
        {(['all', 'recent', 'favourites'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 font-bold text-xs uppercase tracking-widest"
            style={{
              borderRadius: 12,
              border: `2px solid ${tab === t ? '#58cc02' : '#e5e5e5'}`,
              borderBottom: `3px solid ${tab === t ? '#46a302' : '#e5e5e5'}`,
              background: tab === t ? '#58cc02' : '#ffffff',
              color: tab === t ? '#ffffff' : '#777777',
            }}
          >
            {t === 'favourites' ? '♥ FAV' : t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-5 flex flex-col gap-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🦉</p>
            <p className="font-bold text-sm uppercase tracking-widest" style={{ color: '#777777' }}>No Buddies found</p>
          </div>
        ) : filtered.map((buddy) => (
          <BuddyCard key={buddy.id} buddy={buddy} isFav={favs.includes(buddy.id)} onToggleFav={toggleFav} onBook={() => navigate(`/book/${buddy.id}`)} />
        ))}
      </div>

      <BottomNav unreadCount={unread} />
    </div>
  )
}

function BuddyCard({ buddy, isFav, onToggleFav, onBook }: {
  buddy: Buddy; isFav: boolean; onToggleFav: (id: string) => void; onBook: () => void
}) {
  return (
    <div className="p-4 card-border">
      <div className="flex items-start gap-3 mb-3">
        <img src={buddy.avatar} alt={buddy.name} className="w-14 h-14 rounded-xl object-cover" style={{ border: '2px solid #e5e5e5', borderBottom: '3px solid #e5e5e5' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base truncate" style={{ color: '#042c60', letterSpacing: '0.03em' }}>{buddy.name}</h3>
            <button onClick={() => onToggleFav(buddy.id)} className="p-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? '#ff4b4b' : 'none'} stroke={isFav ? '#ff4b4b' : '#777777'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span style={{ color: '#ffd700' }}>★</span>
            <span className="font-bold text-sm" style={{ color: '#3c3c3c' }}>{buddy.rating}</span>
            <span className="font-medium text-xs" style={{ color: '#777777' }}>· {buddy.totalLessons} lessons</span>
          </div>
        </div>
      </div>
      <p className="font-medium text-sm mb-3 leading-relaxed" style={{ color: '#4b4b4b', letterSpacing: '0.03em' }}>{buddy.bio}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {buddy.topics.map((t) => (
          <span
            key={t}
            className="font-bold text-xs px-3 py-1 uppercase tracking-widest"
            style={{ background: '#d7ffb8', color: '#46a302', borderRadius: 12, border: '1px solid #a5ed6e' }}
          >
            {t}
          </span>
        ))}
      </div>
      <button onClick={onBook} className="btn-primary w-full py-3 text-sm font-bold">
        BOOK WITH {buddy.name.split(' ')[0].toUpperCase()}
      </button>
    </div>
  )
}
