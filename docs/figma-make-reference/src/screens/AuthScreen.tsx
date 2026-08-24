import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type View = 'signup' | 'login' | 'forgot'

export default function AuthScreen() {
  const [view, setView] = useState<View>('signup')

  return (
    <div className="min-h-screen" style={{ background: '#ffffff' }}>
      {view === 'signup' && <SignupView onLogin={() => setView('login')} />}
      {view === 'login' && <LoginView onSignup={() => setView('signup')} onForgot={() => setView('forgot')} />}
      {view === 'forgot' && <ForgotView onBack={() => setView('login')} />}
    </div>
  )
}

/* ─── Shared primitives ────────────────────────────────────────────── */

function BackArrow({ onPress }: { onPress: () => void }) {
  return (
    <div className="flex justify-end px-5 pt-12 pb-2">
      <button onClick={onPress} className="w-9 h-9 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#777777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  )
}

function GrayInput({
  placeholder, type = 'text', value, onChange, right,
}: {
  placeholder: string
  type?: string
  value: string
  onChange: (v: string) => void
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center px-4" style={{ background: '#f0f0f0', borderRadius: 14, height: 56 }}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none font-medium"
        style={{ fontSize: 15, color: '#3c3c3c', fontFamily: 'Nunito, sans-serif', letterSpacing: '0.02em' }}
      />
      {right}
    </div>
  )
}

function BlueButton({ label, onClick, loading }: { label: string; onClick?: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full font-bold uppercase"
      style={{
        height: 52,
        borderRadius: 14,
        background: '#1cb0f6',
        border: '2px solid #18a0dc',
        borderBottom: '4px solid #18a0dc',
        color: '#ffffff',
        fontSize: 15,
        letterSpacing: '0.08em',
        fontFamily: 'Nunito, sans-serif',
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'default' : 'pointer',
      }}
    >
      {loading ? 'Please wait…' : label}
    </button>
  )
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: '#e5e5e5' }} />
      <span className="font-bold text-xs uppercase tracking-widest" style={{ color: '#afafaf' }}>OR</span>
      <div className="flex-1 h-px" style={{ background: '#e5e5e5' }} />
    </div>
  )
}

function SocialButtons({ onGoogle }: { onGoogle: () => void }) {
  return (
    <button
      onClick={onGoogle}
      className="w-full flex items-center justify-center gap-2 font-bold uppercase"
      style={{
        height: 52,
        borderRadius: 14,
        border: '2px solid #e5e5e5',
        background: '#ffffff',
        fontSize: 13,
        color: '#3c3c3c',
        letterSpacing: '0.06em',
        fontFamily: 'Nunito, sans-serif',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Google
    </button>
  )
}

function LegalText({ action }: { action: string }) {
  return (
    <p className="text-center font-medium" style={{ fontSize: 13, color: '#afafaf', lineHeight: 1.6, letterSpacing: '0.01em' }}>
      By {action} to 10 Minute English, you agree to our{' '}
      <span className="font-bold" style={{ color: '#777777' }}>Terms</span> and{' '}
      <span className="font-bold" style={{ color: '#777777' }}>Privacy Policy</span>.
    </p>
  )
}

/* ─── Signup view ──────────────────────────────────────────────────── */

function SignupView({ onLogin }: { onLogin: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); navigate('/onboarding') }, 900)
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#ffffff' }}>
      <BackArrow onPress={() => navigate(-1)} />

      <div className="flex-1 px-5 flex flex-col justify-center gap-5 pb-8">
        <h1
          className="text-center font-bold"
          style={{ fontSize: 26, color: '#3c3c3c', fontFamily: 'Nunito, sans-serif', letterSpacing: '0.01em' }}
        >
          Create your profile
        </h1>

        <div className="flex flex-col gap-3">
          <GrayInput placeholder="Name (optional)" value={name} onChange={setName} />
          <GrayInput placeholder="Email" type="email" value={email} onChange={setEmail} />
          <GrayInput
            placeholder="Password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            right={
              <button onClick={() => setShowPw((v) => !v)} className="ml-2 flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1cb0f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showPw ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            }
          />
        </div>

        <BlueButton label="Create Account" onClick={submit} loading={loading} />

        <OrDivider />

        <SocialButtons
          onGoogle={() => { setLoading(true); setTimeout(() => { setLoading(false); navigate('/onboarding') }, 700) }}
        />

        <LegalText action="signing up" />
      </div>

      <div className="px-5 pb-8 text-center">
        <span className="font-bold" style={{ fontSize: 15, color: '#3c3c3c' }}>Have an account? </span>
        <button onClick={onLogin} className="font-bold" style={{ fontSize: 15, color: '#1cb0f6' }}>
          LOG IN
        </button>
      </div>
    </div>
  )
}

/* ─── Login view ───────────────────────────────────────────────────── */

function LoginView({ onSignup, onForgot }: { onSignup: () => void; onForgot: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); navigate('/dashboard') }, 900)
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#ffffff' }}>
      <BackArrow onPress={onSignup} />

      <div className="flex-1 px-5 flex flex-col justify-center gap-5 pb-8">
        <h1
          className="text-center font-bold"
          style={{ fontSize: 26, color: '#3c3c3c', fontFamily: 'Nunito, sans-serif', letterSpacing: '0.01em' }}
        >
          Log in
        </h1>

        <div className="flex flex-col gap-3">
          <GrayInput placeholder="Email" type="email" value={email} onChange={setEmail} />
          <GrayInput
            placeholder="Password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            right={
              <button onClick={() => setShowPw((v) => !v)} className="ml-2 flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1cb0f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showPw ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            }
          />
        </div>

        <button onClick={onForgot} className="text-right font-bold" style={{ fontSize: 13, color: '#1cb0f6', letterSpacing: '0.02em' }}>
          Forgot password?
        </button>

        <BlueButton label="Log In" onClick={submit} loading={loading} />

        <OrDivider />

        <SocialButtons
          onGoogle={() => { setLoading(true); setTimeout(() => { setLoading(false); navigate('/dashboard') }, 700) }}
        />

        <LegalText action="signing in" />
      </div>

      <div className="px-5 pb-8 text-center">
        <span className="font-bold" style={{ fontSize: 15, color: '#3c3c3c' }}>Don't have an account? </span>
        <button onClick={onSignup} className="font-bold" style={{ fontSize: 15, color: '#1cb0f6' }}>
          SIGN UP
        </button>
      </div>
    </div>
  )
}

/* ─── Forgot password view ─────────────────────────────────────────── */

function ForgotView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 800)
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#ffffff' }}>
      <BackArrow onPress={onBack} />

      <div className="flex-1 px-5 flex flex-col justify-center gap-5 pb-8">
        {sent ? (
          <div className="text-center">
            <div className="text-6xl mb-5">📬</div>
            <h1 className="font-bold text-2xl mb-2" style={{ color: '#3c3c3c', fontFamily: 'Nunito, sans-serif' }}>Check your inbox</h1>
            <p className="font-medium" style={{ fontSize: 15, color: '#afafaf' }}>
              We sent a reset link to{' '}
              <span className="font-bold" style={{ color: '#1cb0f6' }}>{email}</span>
            </p>
            <button onClick={onBack} className="mt-8 font-bold uppercase" style={{ fontSize: 13, color: '#1cb0f6', letterSpacing: '0.06em' }}>
              ← Back to log in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-center font-bold" style={{ fontSize: 26, color: '#3c3c3c', fontFamily: 'Nunito, sans-serif' }}>
              Forgot password?
            </h1>
            <p className="text-center font-medium" style={{ fontSize: 15, color: '#afafaf' }}>
              Enter your email and we'll send a reset link.
            </p>
            <GrayInput placeholder="Email" type="email" value={email} onChange={setEmail} />
            <BlueButton label="Send Reset Link" onClick={submit} loading={loading} />
          </>
        )}
      </div>
    </div>
  )
}
