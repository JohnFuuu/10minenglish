// Optional phone numbers for members and Buddies. Lenient on purpose: people
// write numbers many ways (+64 21 123 4567, (09) 123-4567), so we only check
// it's made of phone characters with a sensible number of digits.

const PHONE_CHARS = /^\+?[0-9\s\-().]+$/;
const MIN_DIGITS = 6;
const MAX_DIGITS = 15; // the international (E.164) maximum

export type PhoneNumberInput =
  | { kind: 'unchanged' }
  | { kind: 'clear' }
  | { kind: 'set'; value: string }
  | { kind: 'invalid' };

// What a profile edit asked for: absent = leave it, blank = remove it.
export function readPhoneNumber(raw: unknown): PhoneNumberInput {
  if (raw === undefined) return { kind: 'unchanged' };
  if (raw === null) return { kind: 'clear' };
  if (typeof raw !== 'string') return { kind: 'invalid' };
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value === '') return { kind: 'clear' };
  const digits = value.replace(/\D/g, '').length;
  if (!PHONE_CHARS.test(value) || digits < MIN_DIGITS || digits > MAX_DIGITS) return { kind: 'invalid' };
  return { kind: 'set', value };
}

export const INVALID_PHONE_MESSAGE = 'That doesn’t look like a phone number';
