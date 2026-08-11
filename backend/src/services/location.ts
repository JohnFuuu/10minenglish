// Approximates whether a free-text Location field indicates New Zealand.
// Per docs/adr/0004, this is a known approximation (an NZ citizen abroad, or
// a foreign resident with an NZ bank account, are edge cases not handled).
export function isLikelyNewZealand(location: string | undefined): boolean {
  if (!location) return false;
  const normalized = location.toLowerCase();
  return normalized.includes('nz') || normalized.includes('new zealand');
}
