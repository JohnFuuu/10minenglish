interface CreditCoinProps {
  /** Pixel size, or any CSS length. Defaults to 1em so it scales with the surrounding text. */
  size?: number | string;
  className?: string;
  /** Accepted (and ignored) so the coin can stand in for a lucide icon. */
  strokeWidth?: number;
}

/**
 * The Credit symbol: a gold coin with a crown. Shown next to every credit
 * balance so the number can't be mistaken for dollars or a count of meetings.
 */
export function CreditCoin({ size = '1em', className }: CreditCoinProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 ${className ?? ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="11.5" fill="#F59E0B" />
      <circle cx="12" cy="12" r="9.5" fill="#FCD34D" />
      <path d="M5.2 8.6a8 8 0 0 1 6.8-5.1" stroke="#FEF3C7" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M7 9 9.6 12 12 7.6 14.4 12 17 9l-1 6H8z" fill="#D97706" strokeLinejoin="round" />
      <circle cx="7" cy="9" r="1.1" fill="#D97706" />
      <circle cx="12" cy="7.6" r="1.1" fill="#D97706" />
      <circle cx="17" cy="9" r="1.1" fill="#D97706" />
      <rect x="8" y="16" width="8" height="1.7" rx="0.85" fill="#D97706" />
    </svg>
  );
}

/**
 * Line-icon version of the coin, drawn like a lucide icon (currentColor,
 * stroked) so it sits quietly among other line icons, e.g. the Dashboard's
 * quick actions. Use the gold CreditCoin next to actual numbers.
 */
export function CreditCoinOutline({ size = 24, className, strokeWidth = 2 }: CreditCoinProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M6.5 8.5 9.5 12 12 6.5l2.5 5.5 3-3.5-1.3 6.3H7.8z" />
      <path d="M9.5 17.8h5" />
    </svg>
  );
}

interface CreditAmountProps {
  value: number;
  className?: string;
}

/** A credit number with the coin in front of it — use this wherever a credit balance is shown. */
export function CreditAmount({ value, className }: CreditAmountProps) {
  return (
    <span className={`inline-flex items-center gap-[0.25em] align-middle ${className ?? ''}`}>
      <CreditCoin size="0.9em" />
      {value}
      <span className="sr-only"> {value === 1 ? 'credit' : 'credits'}</span>
    </span>
  );
}

interface CreditBalanceCardProps {
  value: number;
  /** Extra line under the number (e.g. what a meeting costs). */
  children?: React.ReactNode;
  className?: string;
}

/** The one credit-balance graphic, used everywhere a User's balance is shown on its own. */
export function CreditBalanceCard({ value, children, className }: CreditBalanceCardProps) {
  return (
    <div className={`rounded-md border-2 border-b-[5px] border-brand-primary-border bg-brand-primary p-4 ${className ?? ''}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-accent-lime-light">Credit balance</p>
      <p className="font-display text-4xl font-black text-text-inverse">
        <CreditAmount value={value} />
      </p>
      {children}
    </div>
  );
}
