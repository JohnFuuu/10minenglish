import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchLessonPrice } from './api';

// Credits one Lesson costs right now (Admin-set, see the Pricing tab).
// Reads as 1 — the long-standing price — until the real value arrives; the
// server charges the real price regardless.
export function useLessonPrice(): number {
  const { token } = useAuth();
  const [creditsPerLesson, setCreditsPerLesson] = useState(1);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchLessonPrice(token)
      .then((res) => {
        if (!cancelled) setCreditsPerLesson(res.creditsPerLesson);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);
  return creditsPerLesson;
}

export function creditsLabel(n: number): string {
  return `${n} credit${n === 1 ? '' : 's'}`;
}
