import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

// The subtitle that names each module on an Admin tab (e.g. "Buddy roster",
// "Member list"): bold black in the display font (Inter), so it reads as a
// heading against the Nunito body text.
export function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'mb-1 font-display text-lg font-extrabold text-black',
        className,
      )}
    >
      {children}
    </h2>
  );
}
