import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { buddies, buddyAvailability, currentUser } from '../data/mockData'

type Step = 'day' | 'time' | 'type' | 'confirm' | 'success'
const STEP_ORDER: Step[] = ['day', 'time', 'type', 'confirm']

export default function BookingScreen() {
  const { buddyId } = useParams()
  const navigate = useNavigate()
  const buddy = buddies.find((b) => b.id === buddyId) || buddies[0]

  const [step, setStep] = useState<Step>('day')
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [bookingType, setBookingType] = useState<'single' | 'recurring'>('single')
  const [recurringPattern, setRecurringPattern] = useState<'weekly' | 'daily'>('weekly')
  const [loading, setLoading] = useState(false)

  const availDay = buddyAvailability.find((a) => a.day === selectedDay)
  const DAY_NAMES: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }

  const handleConfirm = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setStep('success') }, 1000)
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#ffffff' }}>
        <div className="text-7xl mb-4">🎉</div>
        <h1
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 28, color: '#58cc02', letterSpacing: '-0.01em' }}
        >
          BOOKED!
        </h1>
        <p className="font-medium text-sm mt-2 mb-1" style={{ color: '#4b4b4b' }}>
          Session with <strong>{buddy.name}</strong>
        </p>
        <p className="font-medium text-sm mb-1" style={{ color: '#4b4b4b' }}>{DAY_NAMES[selectedDay] || selectedDay} · {selectedTime}</p>
        <p className="font-medium text-xs mt-2 mb-8" style={{ color: '#777777' }}>1 credit deducted · Confirmation email sent</p>
        <button onClick={() => navigate('/lessons')} className="btn-primary w-full py-4 text-sm font-bold mb-3">
          VIEW MY LESSONS
        </button>
        <button onClick={() => navigate('/buddies')} className="btn-outline w-full py-4 text-sm font-bold">
          BACK TO BUDDIES
        </button>
      </div>
    )
  }

  const stepIndex = STEP_ORDER.indexOf(step)

  return (
    <div className="min-h-screen pb-10" style={{ background: '#ffffff' }}>
      <Header title="Book a Lesson" showBack />

      {/* Buddy pill */}
      <div className="px-5 mt-4 mb-4">
        <div className="flex items-center gap-3 p-3" style={{ border: '2px solid #a5ed6e', borderBottom: '3px solid #a5ed6e', borderRadius: 12 }}>
          <img src={buddy.avatar} alt={buddy.name} className="w-10 h-10 rounded-full object-cover" />
          <div>
            <p className="font-bold text-sm" style={{ color: '#042c60' }}>{buddy.name}</p>
            <p className="font-medium text-xs" style={{ color: '#777777' }}>★ {buddy.rating} · {buddy.totalLessons} lessons</p>
          </div>
        </div>
      </div>

      {/* Step bar */}
      <div className="px-5 mb-5">
        <div className="flex gap-1.5">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className="flex-1 h-2 rounded-full"
              style={{ background: i <= stepIndex ? '#58cc02' : '#e5e5e5' }}
            />
          ))}
        </div>
        <p className="font-bold text-xs uppercase tracking-widest mt-2" style={{ color: '#777777' }}>
          Step {stepIndex + 1} of {STEP_ORDER.length}
        </p>
      </div>

      <div className="px-5">
        {/* Step 1 */}
        {step === 'day' && (
          <>
            <h2 className="font-bold text-lg mb-4 uppercase tracking-widest" style={{ color: '#042c60' }}>Choose a day</h2>
            <div className="flex flex-col gap-2">
              {buddyAvailability.map((a) => (
                <button
                  key={a.day}
                  onClick={() => { setSelectedDay(a.day); setStep('time') }}
                  className="flex items-center justify-between p-4"
                  style={{
                    borderRadius: 12,
                    border: `2px solid ${selectedDay === a.day ? '#58cc02' : '#3c3c3c'}`,
                    borderBottom: `4px solid ${selectedDay === a.day ? '#46a302' : '#3c3c3c'}`,
                    background: selectedDay === a.day ? '#58cc02' : '#ffffff',
                    color: selectedDay === a.day ? '#ffffff' : '#042c60',
                  }}
                >
                  <span className="font-bold tracking-wide">{DAY_NAMES[a.day] || a.day}</span>
                  <span className="font-bold text-sm opacity-70">{a.slots.length} slots</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2 */}
        {step === 'time' && availDay && (
          <>
            <h2 className="font-bold text-lg mb-1 uppercase tracking-widest" style={{ color: '#042c60' }}>Choose a time</h2>
            <p className="font-medium text-sm mb-4" style={{ color: '#777777' }}>{buddy.timezone}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {availDay.slots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => { setSelectedTime(slot); setStep('type') }}
                  className="py-4 font-bold text-sm"
                  style={{
                    borderRadius: 12,
                    border: `2px solid ${selectedTime === slot ? '#58cc02' : '#3c3c3c'}`,
                    borderBottom: `4px solid ${selectedTime === slot ? '#46a302' : '#3c3c3c'}`,
                    background: selectedTime === slot ? '#58cc02' : '#ffffff',
                    color: selectedTime === slot ? '#ffffff' : '#042c60',
                    letterSpacing: '0.05em',
                  }}
                >
                  {slot}
                </button>
              ))}
            </div>
            <button onClick={() => setStep('day')} className="font-bold text-sm" style={{ color: '#1cb0f6' }}>← BACK</button>
          </>
        )}

        {/* Step 3 */}
        {step === 'type' && (
          <>
            <h2 className="font-bold text-lg mb-4 uppercase tracking-widest" style={{ color: '#042c60' }}>Booking type</h2>
            <div className="flex flex-col gap-3 mb-5">
              {[
                { value: 'single', label: 'SINGLE LESSON', desc: '1 credit · one session', icon: '1️⃣' },
                { value: 'recurring', label: 'RECURRING', desc: 'Auto-books future sessions', icon: '🔁' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBookingType(opt.value as 'single' | 'recurring')}
                  className="flex items-start gap-3 p-4 text-left"
                  style={{
                    borderRadius: 12,
                    border: `2px solid ${bookingType === opt.value ? '#58cc02' : '#3c3c3c'}`,
                    borderBottom: `4px solid ${bookingType === opt.value ? '#46a302' : '#3c3c3c'}`,
                    background: bookingType === opt.value ? '#f0fde4' : '#ffffff',
                  }}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm tracking-widest uppercase" style={{ color: '#042c60' }}>{opt.label}</p>
                    <p className="font-medium text-xs mt-0.5" style={{ color: '#777777' }}>{opt.desc}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: bookingType === opt.value ? '#58cc02' : '#777777' }}>
                    {bookingType === opt.value && <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#58cc02' }} />}
                  </div>
                </button>
              ))}
            </div>

            {bookingType === 'recurring' && (
              <div className="mb-5 p-4" style={{ background: '#f0fde4', border: '2px solid #a5ed6e', borderRadius: 12 }}>
                <p className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: '#46a302' }}>Repeat pattern</p>
                <div className="flex gap-2 mb-3">
                  {(['weekly', 'daily'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setRecurringPattern(p)}
                      className="px-4 py-2 font-bold text-xs uppercase tracking-widest"
                      style={{
                        borderRadius: 12,
                        border: `2px solid ${recurringPattern === p ? '#58cc02' : '#a5ed6e'}`,
                        borderBottom: `3px solid ${recurringPattern === p ? '#46a302' : '#a5ed6e'}`,
                        background: recurringPattern === p ? '#58cc02' : '#ffffff',
                        color: recurringPattern === p ? '#ffffff' : '#46a302',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="font-medium text-xs" style={{ color: '#46a302' }}>
                  Credits deducted only for successfully booked sessions. Unfillable slots are skipped.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep('time')} className="flex-1 py-3.5 font-bold text-sm" style={{ border: '2px solid #3c3c3c', borderBottom: '4px solid #3c3c3c', borderRadius: 12, color: '#3c3c3c', letterSpacing: '0.05em' }}>BACK</button>
              <button onClick={() => setStep('confirm')} className="btn-primary flex-1 py-3.5 text-sm font-bold">CONTINUE</button>
            </div>
          </>
        )}

        {/* Step 4 */}
        {step === 'confirm' && (
          <>
            <h2 className="font-bold text-lg mb-5 uppercase tracking-widest" style={{ color: '#042c60' }}>Confirm booking</h2>

            <div className="mb-5" style={{ border: '2px solid #3c3c3c', borderBottom: '4px solid #3c3c3c', borderRadius: 12, overflow: 'hidden' }}>
              {[
                { label: 'BUDDY', value: buddy.name },
                { label: 'DAY', value: DAY_NAMES[selectedDay] || selectedDay },
                { label: 'TIME', value: `${selectedTime} (${buddy.timezone})` },
                { label: 'TYPE', value: bookingType === 'recurring' ? `Recurring ${recurringPattern}` : 'Single lesson' },
                { label: 'CREDITS', value: bookingType === 'single' ? '1 credit' : '1 per session' },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{ background: '#ffffff', borderTop: i > 0 ? '1px solid #e5e5e5' : 'none' }}
                >
                  <span className="font-bold text-xs uppercase tracking-widest" style={{ color: '#777777' }}>{row.label}</span>
                  <span className="font-bold text-sm" style={{ color: '#042c60' }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="p-4 mb-5" style={{ background: '#d7ffb8', border: '2px solid #a5ed6e', borderRadius: 12 }}>
              <p className="font-bold text-xs uppercase tracking-widest" style={{ color: '#46a302' }}>Balance after booking</p>
              <p className="font-bold text-base mt-0.5" style={{ color: '#042c60' }}>{currentUser.credits - 1} credits remaining</p>
            </div>

            <button onClick={handleConfirm} disabled={loading} className="btn-primary w-full py-4 text-sm font-bold" style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? 'CONFIRMING…' : 'CONFIRM & DEDUCT 1 CREDIT'}
            </button>
            <button onClick={() => setStep('type')} className="w-full mt-3 font-bold text-sm text-center" style={{ color: '#777777' }}>BACK</button>
          </>
        )}
      </div>
    </div>
  )
}
