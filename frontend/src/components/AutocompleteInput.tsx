import { useId, useMemo, useState, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { FIELD_LABEL_CLASS } from './Input';
import { FlagIcon } from './FlagIcon';

interface AutocompleteInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label?: string;
  id?: string;
  // Looks up the ISO code for an option/the current value, so a flag can
  // show both in the dropdown and inside the field once it matches.
  getFlagCode?: (value: string) => string | undefined;
}

const MAX_SUGGESTIONS = 8;

// A plain text field — the value isn't restricted to `options`, matches are
// just suggestions — that pops a filtered dropdown under it as the user
// types. Used for Nationality/Location, where free text is fine but most
// people are picking from the same few hundred country names anyway.
export function AutocompleteInput({
  value,
  onChange,
  options,
  label,
  id,
  className = '',
  getFlagCode,
  ...props
}: AutocompleteInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const currentFlagCode = getFlagCode?.(value);

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options.slice(0, MAX_SUGGESTIONS);

    // Prefix matches ("Ne" -> "New Zealander") read as more relevant than a
    // mid-word hit ("Ne" -> "Argentine"), so they're ranked first.
    const startsWith: string[] = [];
    const includesOnly: string[] = [];
    for (const option of options) {
      const lower = option.toLowerCase();
      if (lower.startsWith(query)) startsWith.push(option);
      else if (lower.includes(query)) includesOnly.push(option);
    }
    return [...startsWith, ...includesOnly].slice(0, MAX_SUGGESTIONS);
  }, [value, options]);

  const showDropdown = isOpen && matches.length > 0;

  function selectOption(option: string) {
    onChange(option);
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) {
      if (e.key === 'ArrowDown') setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && matches[highlightedIndex]) {
      e.preventDefault();
      selectOption(matches[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className={FIELD_LABEL_CLASS}>
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border-2 border-border bg-bg-surface px-4 transition-colors focus-within:border-brand-secondary',
        )}
      >
        {getFlagCode && <FlagIcon code={currentFlagCode} />}
        <input
          id={inputId}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          className={cn(
            'w-full flex-1 bg-transparent py-3 text-sm font-medium text-text-body outline-none placeholder:text-text-secondary',
            className,
          )}
          {...props}
        />
      </div>

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border-2 border-border bg-bg-surface py-1"
        >
          {matches.map((option, index) => (
            <li key={option} role="option" aria-selected={index === highlightedIndex}>
              <button
                type="button"
                // Fires before the input's onBlur closes the dropdown.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(option)}
                className={cn(
                  'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-text-body',
                  index === highlightedIndex ? 'bg-brand-secondary/10' : '',
                )}
              >
                {getFlagCode && <FlagIcon code={getFlagCode(option)} />}
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
