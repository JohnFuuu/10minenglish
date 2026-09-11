import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ title, onClose, children, className = '' }: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex max-h-[85vh] w-full flex-col rounded-md border-2 border-border-strong bg-bg-surface sm:max-w-md',
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b-2 border-border px-5 py-4">
          <h2 className="font-display text-lg font-black text-text-heading">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-border"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
