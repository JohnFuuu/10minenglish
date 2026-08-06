interface BadgeProps {
  count: number | string;
}

export function Badge({ count }: BadgeProps) {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-error text-xs text-text-inverse">
      {count}
    </span>
  );
}
