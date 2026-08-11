import { useEffect, useState } from 'react';
import { cn } from '../lib/cn';

export type ToastType = 'error' | 'success';

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

// Solid-fill, pressable-border toast matching the rest of the Duolingo-style
// system — no drop shadow, depth from the thick bottom border instead.
export function Toast({ message, type, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const isError = type === 'error';

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-5">
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          'flex max-w-sm items-center gap-2 rounded-md border-2 border-b-[4px] px-5 py-3 text-left text-sm font-bold text-text-inverse transition-all duration-200',
          isError ? 'border-error-border bg-error' : 'border-brand-primary-border bg-brand-primary',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        )}
      >
        <span>{isError ? '⚠️' : '✅'}</span>
        {message}
      </button>
    </div>
  );
}
