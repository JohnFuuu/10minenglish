import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['rounded-lg bg-bg-surface p-4 shadow-card', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
