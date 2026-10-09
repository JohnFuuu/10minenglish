import { useState } from 'react';
import { Input } from '../components';

// Quick picks in simple English, so nobody has to type; "Other" opens a
// short text box. Always optional — the reason is shown to the other person.
export const MEMBER_CANCEL_REASONS = ['I’m busy', 'I’m sick', 'Need a different time'] as const;
export const BUDDY_CANCEL_REASONS = ['I’m sick', 'Something came up', 'Internet or tech problem'] as const;
const OTHER = 'Other';

export function CancelReason({
  reasons,
  toldTo,
  onChange,
}: {
  reasons: readonly string[];
  // Who sees the reason, e.g. "your Buddy" or "the member".
  toldTo: string;
  onChange: (reason: string | undefined) => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState('');

  function pick(next: string) {
    const value = choice === next ? null : next; // tap again to clear
    setChoice(value);
    onChange(value === OTHER ? other.trim() || undefined : value ?? undefined);
  }

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-bold text-text-body">
        Why are you cancelling? <span className="font-medium text-text-secondary">(optional — we tell {toldTo})</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[...reasons, OTHER].map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={choice === r}
            onClick={() => pick(r)}
            className={
              choice === r
                ? 'rounded-full border-2 border-brand-secondary bg-brand-secondary px-3 py-1 text-xs font-bold text-text-inverse'
                : 'rounded-full border-2 border-border bg-bg-surface px-3 py-1 text-xs font-bold text-text-heading'
            }
          >
            {r}
          </button>
        ))}
      </div>
      {choice === OTHER && (
        <Input
          aria-label="Your reason"
          placeholder={`Tell ${toldTo} why`}
          maxLength={200}
          value={other}
          onChange={(e) => {
            setOther(e.target.value);
            onChange(e.target.value.trim() || undefined);
          }}
          className="mt-2"
        />
      )}
    </div>
  );
}
