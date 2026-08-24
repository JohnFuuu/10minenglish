import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { buddies as initialBuddies, creditPacks as initialPacks, type Buddy, type CreditPack } from '../data/mockData'

export default function AdminPanel() {
  const [tab, setTab] = useState<'buddies' | 'credits' | 'provision'>('buddies')
  const [buddyList, setBuddyList] = useState(initialBuddies)
  const [packs, setPacks] = useState(initialPacks)
  const [editingPack, setEditingPack] = useState<string | null>(null)
  const [newPrice, setNewPrice] = useState('')
  const [provisionName, setProvisionName] = useState('')
  const [provisionEmail, setProvisionEmail] = useState('')
  const [provisioned, setProvisioned] = useState(false)
  const navigate = useNavigate()

  const toggleBuddy = (id: string) =>
    setBuddyList((prev) => prev.map((b) => b.id === id ? { ...b, active: !b.active } : b))

  const savePack = (id: string) => {
    const price = parseFloat(newPrice)
    if (!isNaN(price) && price > 0) setPacks((prev) => prev.map((p) => p.id === id ? { ...p, price } : p))
    setEditingPack(null)
    setNewPrice('')
  }

  const handleProvision = (e: React.FormEvent) => {
    e.preventDefault()
    setProvisioned(true)
    setProvisionName('')
    setProvisionEmail('')
    setTimeout(() => setProvisioned(false), 2500)
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: '#ffffff' }}>
      <Header
        title="Admin Panel"
        showBack
        right={<button onClick={() => navigate('/dashboard')} className="font-bold text-xs uppercase tracking-widest" style={{ color: '#777777' }}>EXIT</button>}
      />

      {/* Warning */}
      <div className="mx-5 mt-4 mb-4 p-3 flex items-center gap-2" style={{ background: '#fff3cd', border: '2px solid #ffd700', borderBottom: '3px solid #ffd700', borderRadius: 12 }}>
        <span>⚠️</span>
        <p className="font-bold text-xs uppercase tracking-widest" style={{ color: '#856404' }}>Changes take effect immediately</p>
      </div>

      {/* Tabs */}
      <div className="flex px-5 gap-2 mb-5">
        {(['buddies', 'credits', 'provision'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 font-bold text-xs uppercase tracking-widest"
            style={{
              borderRadius: 12,
              border: `2px solid ${tab === t ? '#042c60' : '#e5e5e5'}`,
              borderBottom: `3px solid ${tab === t ? '#042c60' : '#e5e5e5'}`,
              background: tab === t ? '#042c60' : '#ffffff',
              color: tab === t ? '#ffffff' : '#777777',
            }}
          >
            {t === 'provision' ? 'ADD' : t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="px-5">
        {/* Buddies tab */}
        {tab === 'buddies' && (
          <>
            <p className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#777777' }}>Manage Buddies</p>
            <div className="flex flex-col gap-3">
              {buddyList.map((b) => (
                <BuddyAdminCard key={b.id} buddy={b} onToggle={() => toggleBuddy(b.id)} />
              ))}
            </div>
          </>
        )}

        {/* Credits tab */}
        {tab === 'credits' && (
          <>
            <p className="font-bold text-xs uppercase tracking-widest mb-1" style={{ color: '#777777' }}>Credit pack pricing</p>
            <p className="font-medium text-xs mb-4" style={{ color: '#777777' }}>Edit prices without code deploy.</p>
            <div className="flex flex-col gap-3">
              {packs.map((p) => (
                <div key={p.id} className="card-border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center font-bold text-sm" style={{ border: '2px solid #e5e5e5', borderRadius: 12, color: '#042c60' }}>
                        {p.size}
                      </div>
                      <div>
                        <p className="font-bold text-sm uppercase tracking-widest" style={{ color: '#042c60' }}>{p.size} credits</p>
                        {p.popular && <span className="font-bold text-xs" style={{ color: '#58cc02' }}>POPULAR</span>}
                      </div>
                    </div>
                    {editingPack === p.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          placeholder={String(p.price)}
                          className="w-20 px-2 py-1.5 text-sm font-bold outline-none text-right"
                          style={{ border: '2px solid #1cb0f6', borderBottom: '3px solid #1cb0f6', borderRadius: 12, fontFamily: 'Nunito, sans-serif' }}
                        />
                        <button onClick={() => savePack(p.id)} className="btn-primary px-3 py-1.5 text-xs font-bold">SAVE</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-base" style={{ color: '#042c60' }}>${p.price} {p.currency}</span>
                        <button onClick={() => { setEditingPack(p.id); setNewPrice(String(p.price)) }} className="font-bold text-xs uppercase tracking-widest" style={{ color: '#58cc02' }}>EDIT</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Provision tab */}
        {tab === 'provision' && (
          <>
            <p className="font-bold text-xs uppercase tracking-widest mb-1" style={{ color: '#777777' }}>Add Buddy account</p>
            <p className="font-medium text-xs mb-5" style={{ color: '#777777' }}>Buddies cannot self-register. Use this form to create their account.</p>

            {provisioned && (
              <div className="mb-4 p-3 flex items-center gap-2" style={{ background: '#d7ffb8', border: '2px solid #a5ed6e', borderRadius: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#46a302" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="font-bold text-xs uppercase tracking-widest" style={{ color: '#46a302' }}>Account created. Invite email sent.</p>
              </div>
            )}

            <form onSubmit={handleProvision} className="flex flex-col gap-4">
              {[
                { label: 'Full name', value: provisionName, setter: setProvisionName, type: 'text', placeholder: 'Jane Smith' },
                { label: 'Email', value: provisionEmail, setter: setProvisionEmail, type: 'email', placeholder: 'jane@example.com' },
              ].map((field) => (
                <div key={field.label} className="flex flex-col gap-1.5">
                  <label className="font-bold text-xs uppercase tracking-widest" style={{ color: '#777777' }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3.5 text-sm font-medium outline-none"
                    style={{ border: '2px solid #e5e5e5', borderBottom: '3px solid #e5e5e5', borderRadius: 12, fontFamily: 'Nunito, sans-serif', color: '#3c3c3c', background: '#ffffff' }}
                    onFocus={(e) => { e.target.style.borderColor = '#1cb0f6' }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e5e5'; e.target.style.borderBottomColor = '#e5e5e5' }}
                  />
                </div>
              ))}
              <button type="submit" className="w-full py-4 font-bold text-sm uppercase tracking-widest" style={{ background: '#042c60', borderRadius: 12, border: '2px solid #042c60', borderBottom: '4px solid #000437', color: '#ffffff', letterSpacing: '0.05em' }}>
                CREATE BUDDY ACCOUNT
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function BuddyAdminCard({ buddy, onToggle }: { buddy: Buddy; onToggle: () => void }) {
  return (
    <div className="card-border p-4" style={{ opacity: buddy.active ? 1 : 0.65 }}>
      <div className="flex items-center gap-3">
        <img src={buddy.avatar} alt={buddy.name} className="w-11 h-11 rounded-xl object-cover" />
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: '#042c60' }}>{buddy.name}</p>
          <p className="font-medium text-xs" style={{ color: '#777777' }}>{buddy.totalLessons} lessons · ★ {buddy.rating}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className="font-bold text-xs px-2.5 py-1 uppercase tracking-widest"
            style={{
              background: buddy.active ? '#d7ffb8' : '#fee2e2',
              color: buddy.active ? '#46a302' : '#dc2626',
              borderRadius: 12,
              border: `1px solid ${buddy.active ? '#a5ed6e' : '#fca5a5'}`,
            }}
          >
            {buddy.active ? 'ACTIVE' : 'INACTIVE'}
          </span>
          <button
            onClick={onToggle}
            className="font-bold text-xs uppercase tracking-widest"
            style={{ color: buddy.active ? '#dc2626' : '#58cc02' }}
          >
            {buddy.active ? 'DEACTIVATE' : 'ACTIVATE'}
          </button>
        </div>
      </div>
    </div>
  )
}
