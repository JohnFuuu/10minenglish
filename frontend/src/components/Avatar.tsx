import { cn } from '../lib/cn';

type AvatarSize = 32 | 40 | 56;

interface AvatarProps {
  initials: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, string> = {
  32: 'h-8 w-8 text-xs',
  40: 'h-10 w-10 text-sm',
  56: 'h-14 w-14 text-lg',
};

export function Avatar({ initials, size = 40 }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-2 border-accent-lime bg-brand-primary font-bold text-text-inverse',
        sizeClasses[size],
      )}
    >
      {initials}
    </div>
  );
}
