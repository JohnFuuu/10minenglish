import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { creditPacks, currentUser } from '../data/mockData'

export default function CreditsScreen() {
  const [selected, setSelected] = useState('cp2')
  const [payMethod, setPayMethod] = useState<'stripe' | 'poli'>('stripe')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const pack = creditPacks.find((p) => p.id === selected)!

  const handlePay = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setSuccess(true) }, 1200)
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#ffffff' }}>
        <div className="text-7xl mb-4">🎊</div>
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 28, color: '#58cc02', letterSpacing: '-0.01em' }}>
          CREDITS ADDED!
        </h1>
        <p className="font-medium text-sm mt-2 mb-1" style={{ color: '#4b4b4b' }}>
          {pack.size} credits have been added to your account.
        </p>
        <p className="font-bold text-base mb-8" style={{ color: '#042c60' }}>
          New balance: {currentUser.credits + pack.size} credits 💎
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary w-full py-4 text-sm font-bold">
          BACK TO HOME
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: '#ffffff' }}>
      <Header title="Buy Credits" showBack />

      {/* Balance banner */}
      <div className="mx-5 mt-4 mb-5 p-4" style={{ background: '#58cc02', borderRadius: 12, border: '2px solid #46a302', borderBottom: '5px solid #46a302' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-xs uppercase tracking-widest" style={{ color: '#d7ffb8' }}>Current balance</p>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 40, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {currentUser.credits}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-xs" style={{ color: '#d7ffb8' }}>lessons available</p>
            <p className="font-bold text-xs mt-1" style={{ color: '#ffffff' }}>1 credit = 1 lesson</p>
          </div>
        </div>
      </div>

      {/* Packs */}
      <div className="px-5 mb-5">
        <p className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#777777' }}>Choose a pack</p>
        <div className="flex flex-col gap-2.5">
          {creditPacks.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className="relative flex items-center justify-between p-4"
              style={{
                borderRadius: 12,
                border: `2px solid ${selected === p.id ? '#58cc02' : '#3c3c3c'}`,
                borderBottom: `4px solid ${selected === p.id ? '#46a302' : '#3c3c3c'}`,
                background: selected === p.id ? '#f0fde4' : '#ffffff',
              }}
            >
              {p.popular && (
                <span
                  className="absolute -top-3 left-4 font-bold text-xs uppercase tracking-widest px-2 py-0.5"
                  style={{ background: '#ffd700', color: '#3c3c3c', borderRadius: 12, border: '1px solid #e5c700' }}
                >
                  POPULAR
                </span>
              )}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 flex items-center justify-center font-bold text-sm"
                  style={{
                    borderRadius: 12,
                    border: `2px solid ${selected === p.id ? '#a5ed6e' : '#e5e5e5'}`,
                    background: selected === p.id ? '#d7ffb8' : '#ffffff',
                    color: selected === p.id ? '#46a302' : '#3c3c3c',
                  }}
                >
                  {p.size}
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm uppercase tracking-widest" style={{ color: '#042c60' }}>{p.size} credit{p.size > 1 ? 's' : ''}</p>
                  <p className="font-medium text-xs" style={{ color: '#777777' }}>${(p.price / p.size).toFixed(0)} per credit</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-base" style={{ color: '#042c60' }}>${p.price}</p>
                <p className="font-medium text-xs" style={{ color: '#777777' }}>{p.currency}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Payment method */}
      {currentUser.location === 'NZ' && (
        <div className="px-5 mb-5">
          <p className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#777777' }}>Payment method</p>
          <div className="flex gap-2">
            {[
              { id: 'stripe', label: 'CARD (STRIPE)' },
              { id: 'poli', label: 'POLI (NZ)' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setPayMethod(m.id as 'stripe' | 'poli')}
                className="flex-1 py-3 font-bold text-xs uppercase tracking-widest"
                style={{
                  borderRadius: 12,
                  border: `2px solid ${payMethod === m.id ? '#1cb0f6' : '#e5e5e5'}`,
                  borderBottom: `3px solid ${payMethod === m.id ? '#1cb0f6' : '#e5e5e5'}`,
                  background: payMethod === m.id ? '#e0f7ff' : '#ffffff',
                  color: payMethod === m.id ? '#1cb0f6' : '#777777',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="px-5">
        <button onClick={handlePay} disabled={loading} className="btn-primary w-full py-4 text-sm font-bold" style={{ opacity: loading ? 0.7 : 1 }}>
          {loading ? 'PROCESSING…' : `PAY $${pack.price} ${pack.currency} VIA ${payMethod === 'poli' ? 'POLI' : 'CARD'}`}
        </button>
        <p className="text-center font-medium text-xs mt-3" style={{ color: '#777777' }}>
          Payments are processed securely. Credits added instantly.
        </p>
      </div>
    </div>
  )
}
