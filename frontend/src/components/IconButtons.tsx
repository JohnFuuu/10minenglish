import { LogOut, Undo2 } from 'lucide-react';
import { cn } from '../lib/cn';

// Icon-first buttons for actions people recognise by shape (Back, Log out),
// matching the square bordered style of the Modal's ✕ and the Dashboard's
// header buttons. Each keeps an aria-label so screen readers still get the word.

interface IconButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function BackButton({ onClick, className, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Back"
      title="Back"
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-b-[3px] border-border bg-bg-surface text-text-body disabled:opacity-50',
        className,
      )}
    >
      <Undo2 size={18} strokeWidth={2.5} />
    </button>
  );
}

export function LogoutButton({ onClick, className, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-b-[3px] border-border bg-bg-surface px-2 py-1 text-text-body disabled:opacity-50',
        className,
      )}
    >
      <LogOut size={18} strokeWidth={2.5} />
      <span className="text-[10px] font-bold leading-none">Logout</span>
    </button>
  );
}
