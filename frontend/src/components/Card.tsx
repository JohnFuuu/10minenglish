import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

// "card-border" pattern: thick bottom border stands in for a shadow — this
// system uses no box-shadow anywhere.
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-4',
        className,
      )}
      {...props}
    />
  );
}
