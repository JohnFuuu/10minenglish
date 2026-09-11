import { useCallback, useEffect, useRef, useState } from 'react';
import { readSessionCache, writeSessionCache } from './sessionCache';

// The "show the last known value immediately, refetch silently in the
// background" pattern used by NotificationsScreen/ProfileScreen/
// LessonsScreen/BuddyLessonsScreen — previously hand-rolled once per screen
// as a module-level `let xCache = readSessionCache(...)` + `setXCache()`
// pair. This generalizes that: cache lives in sessionStorage (survives a
// hard reload, not just client-side navigation — see sessionCache.ts), a
// module-level mirror avoids re-parsing JSON on every mount within the same
// tab, and the returned setter writes through to both on every call so a
// mutation (e.g. marking one item read) can't leave the cache stale.
//
// BuddiesScreen's per-tab cache is NOT built on this — it keys a whole
// dictionary of lists by tab and patches every tab's copy on favourite
// toggle, which is a different enough shape (and business-critical enough)
// that folding it in here isn't worth the risk; it still uses
// readSessionCache/writeSessionCache directly.
type Updater<T> = T | ((current: T | null) => T | null);

export function useCachedFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  deps: unknown[],
  options?: { enabled?: boolean; onError?: (err: unknown) => void; onSuccess?: (value: T) => void },
): [T | null, (updater: Updater<T>) => void, boolean] {
  const enabled = options?.enabled ?? true;
  const onError = options?.onError;
  const onSuccess = options?.onSuccess;

  // One mirror per cache key, shared across every mount of this hook with
  // that key (mirrors the old per-screen module-level variable).
  const cacheRef = useRef<{ key: string; value: T | null } | null>(null);
  if (!cacheRef.current || cacheRef.current.key !== cacheKey) {
    cacheRef.current = { key: cacheKey, value: readSessionCache<T>(cacheKey) };
  }

  const [data, setDataState] = useState<T | null>(cacheRef.current.value);
  const [isLoading, setIsLoading] = useState(cacheRef.current.value === null);

  const setData = useCallback(
    (updater: Updater<T>) => {
      setDataState((current) => {
        const next = typeof updater === 'function' ? (updater as (c: T | null) => T | null)(current) : updater;
        // A no-op updater (e.g. "patch this field, but bail out if nothing's
        // loaded yet") can legitimately return null — don't cache that.
        if (next !== null) {
          cacheRef.current = { key: cacheKey, value: next };
          writeSessionCache(cacheKey, next);
        }
        return next;
      });
    },
    [cacheKey],
  );

  useEffect(() => {
    if (!enabled) return;
    fetcher()
      .then((result) => {
        setData(result);
        onSuccess?.(result);
      })
      .catch((err) => onError?.(err))
      .finally(() => setIsLoading(false));
    // `fetcher`/`onError`/`onSuccess`/`setData` are expected to be stable per
    // the caller's own deps array (same contract the original per-screen
    // `useEffect(..., [token])` calls had) — deps is the real trigger list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [data, setData, isLoading];
}
