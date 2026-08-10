import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg bg-bg-surface p-4 shadow-card', className)}
      {...props}
    />
  );
}
