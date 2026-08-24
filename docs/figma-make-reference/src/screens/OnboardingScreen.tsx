import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Option {
  label: string
  icon?: string      // emoji for non-level steps
  bars?: number      // 1–5 for the level step
}

interface OnboardingStep {
  question: string
  options: Option[]
}

const steps: OnboardingStep[] = [
  {
    question: 'How did you hear about 10 Minute English?',
    options: [
      { icon: '👨‍👩‍👧', label: 'Friends or family' },
      { icon: '📱', label: 'TikTok' },
      { icon: '📺', label: 'TV' },
      { icon: '📰', label: 'News / article / blog' },
      { icon: '▶️', label: 'YouTube' },
      { icon: '🔍', label: 'Google Search' },
      { icon: '📘', label: 'Facebook / Instagram' },
      { icon: '💬', label: 'Other' },
    ],
  },
  {
    question: "Okay, we'll build on what you know!",
    options: [
      { bars: 1, label: "I'm new to English" },
      { bars: 2, label: 'I know some common words' },
      { bars: 3, label: 'I can have basic conversations' },
      { bars: 4, label: 'I can talk about various topics' },
      { bars: 5, label: 'I can discuss most topics in detail' },
    ],
  },
  {
    question: 'Why are you learning English?',
    options: [
      { icon: '💼', label: 'Work or career' },
      { icon: '✈️', label: 'Travel' },
      { icon: '🎓', label: 'Study or exams' },
      { icon: '🌏', label: 'Moving abroad' },
      { icon: '🧠', label: 'Personal growth' },
      { icon: '💬', label: 'Other' },
    ],
  },
  {
    question: 'How many lessons per week?',
    options: [
      { icon: '🐢', label: '1–2 lessons — casual pace' },
      { icon: '🚶', label: '3–4 lessons — steady progress' },
      { icon: '🏃', label: '5+ lessons — serious study' },
    ],
  },
]

// Signal bars SVG — filled bars are blue, empty bars are light gray
function SignalBars({ filled, isSelected }: { filled: number; isSelected: boolean }) {
  const barColor = isSelected ? '#1cb0f6' : '#1cb0f6'
  const emptyColor = '#d0e8f5'
  const bars = [
    { x: 2, height: 8, y: 14 },
    { x: 8, height: 11, y: 11 },
    { x: 14, height: 14, y: 8 },
    { x: 20, height: 17, y: 5 },
    { x: 26, height: 20, y: 2 },
  ]
  return (
    <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width="5"
          height={b.height}
          rx="1.5"
          fill={i < filled ? barColor : emptyColor}
        />
      ))}
    </svg>
  )
}

export default function OnboardingScreen() {
  const [stepIndex, setStepIndex] = useState(0)
  const [selections, setSelections] = useState<(string | null)[]>(Array(steps.length).fill(null))
  const navigate = useNavigate()

  const step = steps[stepIndex]
  const selected = selections[stepIndex]
  const progressPct = ((stepIndex + 1) / steps.length) * 100
  const isLast = stepIndex === steps.length - 1

  const select = (label: string) => {
    setSelections((prev) => {
      const next = [...prev]
      next[stepIndex] = label
      return next
    })
  }

  const handleContinue = () => {
    if (!selected) return
    if (isLast) navigate('/dashboard')
    else setStepIndex((i) => i + 1)
  }

  const handleBack = () => {
    if (stepIndex === 0) navigate(-1)
    else setStepIndex((i) => i - 1)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#ffffff' }}>
      {/* Top bar: back arrow + progress bar */}
      <div className="flex items-center gap-4 px-5 pt-12 pb-5">
        <button
          onClick={handleBack}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center"
          style={{ borderRadius: 10, border: '2px solid #e5e5e5', background: '#ffffff' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#777777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: '#e5e5e5' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: '#58cc02' }}
          />
        </div>
      </div>

      {/* Owl + speech bubble */}
      <div className="flex items-center gap-3 px-5 pb-7 pt-1">
        <div
          className="flex-shrink-0 flex items-center justify-center text-5xl"
          style={{ width: 80, height: 80, borderRadius: '50%', background: '#f0f0f0' }}
        >
          🦉
        </div>
        <div
          className="relative flex-1 px-4 py-3.5"
          style={{ background: '#ffffff', border: '2px solid #e5e5e5', borderRadius: 16 }}
        >
          {/* Tail — border layer */}
          <div style={{
            position: 'absolute', left: -10, top: 22,
            width: 0, height: 0,
            borderTop: '9px solid transparent',
            borderBottom: '9px solid transparent',
            borderRight: '11px solid #e5e5e5',
          }} />
          {/* Tail — fill layer */}
          <div style={{
            position: 'absolute', left: -7, top: 23,
            width: 0, height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: '9px solid #ffffff',
          }} />
          <p style={{ fontSize: 17, fontWeight: 700, color: '#3c3c3c', lineHeight: 1.35, fontFamily: 'Nunito, sans-serif' }}>
            {step.question}
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="flex-1 px-5 flex flex-col gap-3 pb-4 overflow-y-auto">
        {step.options.map((opt) => {
          const isSelected = selected === opt.label
          return (
            <button
              key={opt.label}
              onClick={() => select(opt.label)}
              className="flex items-center gap-4 px-4 w-full text-left transition-all"
              style={{
                paddingTop: 14,
                paddingBottom: 14,
                borderRadius: 16,
                border: `2px solid ${isSelected ? '#1cb0f6' : '#e5e5e5'}`,
                background: isSelected ? '#e0f7ff' : '#ffffff',
              }}
            >
              {/* Icon: signal bars for level step, emoji for others */}
              <span
                className="flex-shrink-0 flex items-center justify-center"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: isSelected ? '#b3e9ff' : '#f0f0f0',
                  fontSize: opt.icon ? 22 : undefined,
                }}
              >
                {opt.bars !== undefined
                  ? <SignalBars filled={opt.bars} isSelected={isSelected} />
                  : opt.icon}
              </span>

              <span
                className="flex-1 font-bold"
                style={{
                  fontSize: 15,
                  color: isSelected ? '#1cb0f6' : '#3c3c3c',
                  fontFamily: 'Nunito, sans-serif',
                  letterSpacing: '0.02em',
                }}
              >
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* CONTINUE — disabled until selection */}
      <div className="px-5 pb-8 pt-3" style={{ background: '#ffffff' }}>
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="w-full py-4 font-bold text-sm uppercase tracking-widest transition-all"
          style={{
            borderRadius: 12,
            background: selected ? '#58cc02' : '#e5e5e5',
            border: `2px solid ${selected ? '#46a302' : '#d0d0d0'}`,
            borderBottom: `4px solid ${selected ? '#46a302' : '#d0d0d0'}`,
            color: selected ? '#ffffff' : '#afafaf',
            fontFamily: 'Nunito, sans-serif',
            cursor: selected ? 'pointer' : 'default',
            letterSpacing: '0.08em',
          }}
        >
          {isLast ? "LET'S GO!" : 'CONTINUE'}
        </button>
      </div>
    </div>
  )
}
