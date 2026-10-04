// Every IANA zone name the browser's ICU data knows — the same set the
// backend accepts (it validates via Intl.DateTimeFormat too, see
// backend/src/routes/buddy.ts's isValidTimezone), so anything picked here is
// guaranteed to save.
export const TIMEZONE_NAMES: string[] = (
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
).sort();
