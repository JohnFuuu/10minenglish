import { useEffect, useState } from 'react';
import { Button, Input } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { adminUpdateLessonPrice, fetchLessonPrice } from '../../lib/api';
import { creditsLabel } from '../../lib/useLessonPrice';
import { Ticket } from 'lucide-react';
import { MODULE_FRAME, SectionHeading } from './SectionHeading';

// Matches the backend's MAX_CREDITS_PER_LESSON.
const MAX_CREDITS_PER_LESSON = 20;

// How many credits one Lesson costs. Applies to new bookings only — each
// booked Lesson keeps (and refunds) what it cost — and goes live at once, so
// the change is confirmed first.
export function LessonPriceSetting() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [price, setPrice] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm'>('view');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchLessonPrice(token).then((res) => setPrice(res.creditsPerLesson));
  }, [token]);

  const next = Number(draft);
  const valid = /^\d+$/.test(draft.trim()) && next >= 1 && next <= MAX_CREDITS_PER_LESSON;

  async function save() {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await adminUpdateLessonPrice(token, next);
      setPrice(res.creditsPerLesson);
      setMode('view');
      showToast(`A meeting now costs ${creditsLabel(res.creditsPerLesson)}.`, 'success');
    } catch {
      showToast('Could not change the meeting price.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={`mb-6 ${MODULE_FRAME}`}>
      <div className="mb-1 flex items-center gap-2">
        <Ticket size={20} className="text-brand-primary" aria-hidden="true" />
        <SectionHeading className="mb-0">Meeting price</SectionHeading>
      </div>
      <p className="mb-4 text-sm font-medium text-text-secondary">
        What members <span className="font-bold text-text-body">spend</span>: credits taken from their balance for each
        meeting they book. New bookings only; booked meetings keep their price.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-border bg-bg-surface p-3">
        <p className="font-bold text-text-heading">1 meeting costs</p>
        {mode === 'edit' ? (
          <div className="flex items-center gap-2">
            <Input
              aria-label="Credits per meeting"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CREDITS_PER_LESSON}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-20 text-right"
            />
            <span className="text-sm font-bold text-text-heading">credits</span>
            <Button size="sm" disabled={!valid || next === price} onClick={() => setMode('confirm')}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setMode('view')}>
              Cancel
            </Button>
          </div>
        ) : mode === 'confirm' ? (
          <div className="flex w-full flex-col gap-2 rounded-md bg-warning/10 px-3 py-2">
            <p className="text-sm font-bold text-text-body">
              Change the meeting price from {creditsLabel(price ?? 1)} to {creditsLabel(next)}? New bookings will cost{' '}
              {creditsLabel(next)} straight away.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={isSaving} onClick={save}>
                Change price
              </Button>
              <Button size="sm" variant="secondary" disabled={isSaving} onClick={() => setMode('edit')}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-bold text-text-heading">{price === null ? '…' : creditsLabel(price)}</span>
            <Button
              size="sm"
              variant="secondary"
              disabled={price === null}
              onClick={() => {
                setDraft(String(price));
                setMode('edit');
              }}
            >
              Edit
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
