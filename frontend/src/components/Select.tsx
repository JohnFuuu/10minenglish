import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  // Shown when `value` matches no option (e.g. an "Add a tag…" picker).
  placeholder?: string;
  'aria-label': string;
  disabled?: boolean;
  className?: string;
}

const FIELD =
  'rounded-md border-2 border-border bg-bg-surface text-sm text-text-body transition-colors';

// A dropdown drawn in the app's own style, in place of a native <select>
// whose pop-up list is OS-drawn and can't be styled. Focus stays on the
// trigger (aria-activedescendant), and arrow keys on a closed control only
// open it — they never change the value by themselves, unlike a native
// select on Windows.
export function Select({ value, onChange, options, placeholder, disabled, className, ...props }: SelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!isOpen) return;
    function closeIfOutside(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', closeIfOutside);
    return () => document.removeEventListener('mousedown', closeIfOutside);
  }, [isOpen]);

  function open() {
    setHighlighted(Math.max(selectedIndex, 0));
    setIsOpen(true);
  }

  function choose(option: SelectOption) {
    setIsOpen(false);
    if (option.value !== value) onChange(option.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (options[highlighted]) choose(options[highlighted]);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        role="combobox"
        aria-label={props['aria-label']}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={isOpen ? `${listId}-${highlighted}` : undefined}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
        className={cn(
          FIELD,
          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left focus:border-brand-secondary focus:outline-none disabled:opacity-60',
          isOpen && 'border-brand-secondary',
        )}
      >
        <span className={cn('truncate', !selected && 'text-text-secondary')}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={18} aria-hidden="true" className={cn('shrink-0 text-text-secondary transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <ul id={listId} role="listbox" className={cn(FIELD, 'absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto py-1')}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                // Keep focus on the trigger so keyboard handling continues.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(option)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5',
                  index === highlighted && 'bg-brand-secondary/10',
                  isSelected && 'font-bold text-brand-secondary',
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check size={16} aria-hidden="true" className="shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
