import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Flame,
  Footprints,
  MessageCircle,
  Newspaper,
  Play,
  Search,
  Share2,
  Smartphone,
  Turtle,
  Tv,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { submitOnboarding } from '../lib/api';

interface Option {
  label: string;
  icon?: LucideIcon;
  bars?: number;
}

interface OnboardingStep {
  question: string;
  options: Option[];
}

const steps: OnboardingStep[] = [
  {
    question: 'How did you hear about 10 Minute English?',
    options: [
      { icon: Users, label: 'Friends or family' },
      { icon: Smartphone, label: 'TikTok' },
      { icon: Tv, label: 'TV' },
      { icon: Newspaper, label: 'News / article / blog' },
      { icon: Play, label: 'YouTube' },
      { icon: Search, label: 'Google Search' },
      { icon: Share2, label: 'Facebook / Instagram' },
      { icon: MessageCircle, label: 'Other' },
    ],
  },
  {
    question: "What's your current level?",
    options: [
      { bars: 1, label: 'Just Starting Out — learning my first words' },
      { bars: 2, label: 'Finding My Words — can manage simple greetings' },
      { bars: 3, label: 'Getting Comfortable — basic everyday chat' },
      { bars: 4, label: 'Ready to Chat — comfortable with casual conversation' },
      { bars: 5, label: 'Confident Conversations — can talk about most things' },
      { bars: 6, label: 'Almost Fluent — nearly there, just polishing' },
      { bars: 7, label: 'Deep Conversations — ready for anything, nuance and all' },
    ],
  },
  {
    question: 'How many 10 minute conversations per week?',
    options: [
      { icon: Turtle, label: '1–2 conversations — casual pace' },
      { icon: Footprints, label: '3–4 conversations — steady progress' },
      { icon: Flame, label: '5+ conversations — serious study' },
    ],
  },
];

// Bar count scales with `total` (5 for a coarse scale, 7 for the detailed
// one) rather than a hardcoded 5-bar layout, so the same component works
// for any step that uses `bars`.
function SignalBars({ filled, total }: { filled: number; total: number }) {
  const barWidth = 4;
  const gap = 2;
  const minHeight = 7;
  const maxHeight = 20;
  const svgWidth = total * barWidth + (total - 1) * gap;

  return (
    <svg width={svgWidth} height="24" viewBox={`0 0 ${svgWidth} 24`} fill="none">
      {Array.from({ length: total }, (_, i) => {
        const height = minHeight + ((maxHeight - minHeight) * i) / (total - 1);
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={22 - height}
            width={barWidth}
            height={height}
            rx="1.5"
            fill={i < filled ? '#1cb0f6' : '#d0e8f5'}
          />
        );
      })}
    </svg>
  );
}

export function Onboarding() {
  const { account, token, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<(string | null)[]>(
    Array(steps.length).fill(null),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!account || !token) return <Navigate to="/login" replace />;
  if (account.onboardingCompleted) return <Navigate to="/dashboard" replace />;

  const step = steps[stepIndex];
  const selected = selections[stepIndex];
  const progressPct = ((stepIndex + 1) / steps.length) * 100;
  const isLast = stepIndex === steps.length - 1;

  function select(label: string) {
    setSelections((prev) => {
      const next = [...prev];
      next[stepIndex] = label;
      return next;
    });
  }

  async function handleContinue() {
    if (!selected) return;
    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const levelOption = steps[1].options.find((o) => o.label === selections[1]);
      await submitOnboarding(token!, {
        referralSource: selections[0]!,
        selfRatedLevel: levelOption?.bars ?? 1,
        lessonsPerWeekGoal: selections[2]!,
      });
      completeOnboarding();
      navigate('/dashboard');
    } catch {
      setError('Something went wrong saving your answers. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBack() {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 px-5 pt-12 pb-5">
        <button
          onClick={handleBack}
          disabled={stepIndex === 0}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border-2 border-border disabled:opacity-30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#777777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-brand-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-5 pb-7 pt-1">
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-white">
          <img src="/kiwi-mascot.png" alt="" className="h-20 w-20 animate-breathe object-contain" />
        </div>
        <div className="relative flex-1 rounded-2xl border-2 border-border bg-bg-surface px-4 py-3.5">
          <p className="text-lg font-bold leading-snug text-text-body">{step.question}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4">
        {step.options.map((opt) => {
          const isSelected = selected === opt.label;
          return (
            <button
              key={opt.label}
              onClick={() => select(opt.label)}
              className={
                isSelected
                  ? 'flex w-full items-center gap-4 rounded-2xl border-2 border-brand-secondary bg-brand-secondary/10 px-4 py-3.5 text-left transition-all'
                  : 'flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-bg-surface px-4 py-3.5 text-left transition-all'
              }
            >
              <span
                className={
                  isSelected
                    ? 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-brand-secondary/20 text-xl'
                    : 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-[#f0f0f0] text-xl'
                }
              >
                {opt.bars !== undefined ? (
                  <SignalBars filled={opt.bars} total={step.options.length} />
                ) : (
                  opt.icon && <opt.icon size={20} strokeWidth={2.2} />
                )}
              </span>
              <span
                className={
                  isSelected
                    ? 'flex-1 text-sm font-bold text-brand-secondary'
                    : 'flex-1 text-sm font-bold text-text-body'
                }
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="px-5 pb-2 text-center text-sm font-bold text-error">{error}</p>}

      <div className="px-5 pb-8 pt-3">
        <button
          onClick={handleContinue}
          disabled={!selected || isSubmitting}
          className="w-full rounded-md border-2 border-b-[3px] px-6 py-4 text-sm font-bold uppercase tracking-wide text-text-inverse transition-transform active:translate-y-0.5 disabled:cursor-not-allowed"
          style={{
            background: selected ? '#58cc02' : '#e5e5e5',
            borderColor: selected ? '#46a302' : '#d0d0d0',
            color: selected ? '#ffffff' : '#afafaf',
          }}
        >
          {isSubmitting ? 'Saving…' : isLast ? "Let's Go!" : 'Continue'}
        </button>
      </div>
    </div>
  );
}
