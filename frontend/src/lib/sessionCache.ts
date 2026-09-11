// Backs the per-screen "show cached data instantly, refetch in the
// background" pattern (see NotificationsScreen/BuddiesScreen/ProfileScreen/
// LessonsScreen/BuddyLessonsScreen) so it survives a hard page reload, not
// just client-side navigation — a plain module-scope variable is wiped when
// the page's JS reloads. sessionStorage (not localStorage) so a stale cache
// can't outlive the browser tab.
export function readSessionCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or unavailable (e.g. private browsing) — caching
    // is a nice-to-have, so just skip persisting it.
  }
}
