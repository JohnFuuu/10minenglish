import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

// The lime "chip" subtitle that names each module on an Admin tab (e.g.
// "Buddy roster", "Member list").
export function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'mb-1 inline-block rounded-md bg-accent-lime-light px-3 py-1 text-sm font-bold uppercase tracking-wide text-success',
        className,
      )}
    >
      {children}
    </h2>
  );
}
