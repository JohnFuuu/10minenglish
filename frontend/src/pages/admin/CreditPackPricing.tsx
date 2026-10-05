import { useEffect, useState } from 'react';
import { Button, Input } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { adminUpdateCreditPackPrice, fetchCreditPacks, type CreditPack } from '../../lib/api';

// Whole dollars or dollars-and-cents only — e.g. "9", "9.9", "9.99". Rejects
// negatives, letters, and anything past two decimal places.
const PRICE_FORMAT = /^\d+(\.\d{1,2})?$/;

export function CreditPackPricing() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [editingSize, setEditingSize] = useState<number | null>(null);
  const [draftPrice, setDraftPrice] = useState('');
  const [confirmingSize, setConfirmingSize] = useState<number | null>(null);
  const [pendingPriceCents, setPendingPriceCents] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchCreditPacks(token).then((res) => setPacks(res.packs));
  }, [token]);

  function startEdit(pack: CreditPack) {
    setEditingSize(pack.size);
    setDraftPrice((pack.priceCents / 100).toFixed(2));
  }

  // Validates the format and — instead of saving straight away — moves the
  // row into a Confirm/Cancel state, since price changes go live immediately
  // (see AdminLayout's warning banner) and deserve an explicit second step.
  function requestConfirm(size: number) {
    const trimmed = draftPrice.trim();
    if (!PRICE_FORMAT.test(trimmed)) {
      showToast('Enter a valid price, e.g. 9.99.', 'error');
      return;
    }
    setPendingPriceCents(Math.round(Number(trimmed) * 100));
    setConfirmingSize(size);
    setEditingSize(null);
  }

  function cancelConfirm(size: number) {
    setConfirmingSize(null);
    setPendingPriceCents(null);
    setEditingSize(size);
  }

  async function confirmSave(size: number) {
    if (pendingPriceCents === null) return;
    setIsSaving(true);
    try {
      const updated = await adminUpdateCreditPackPrice(token!, size, pendingPriceCents);
      setPacks((prev) => prev.map((p) => (p.size === size ? updated : p)));
      setConfirmingSize(null);
      setSaved(size);
      setTimeout(() => setSaved(null), 2000);
      showToast(`${size}-credit pack is now $${(pendingPriceCents / 100).toFixed(2)} NZD.`, 'success');
      setPendingPriceCents(null);
    } catch {
      showToast('Could not update that price. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mb-10">
      <p className="mb-4 text-sm font-medium text-text-secondary">Edit prices without a code deploy.</p>

      <div className="flex flex-col gap-3">
        {packs.map((pack) => (
          <div
            key={pack.size}
            className="flex items-center justify-between rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-4"
          >
            <p className="font-bold text-text-heading">{pack.size} credits</p>
            {editingSize === pack.size ? (
              <div className="flex items-center gap-2">
                <Input
                  className="w-24 text-right"
                  value={draftPrice}
                  onChange={(e) => setDraftPrice(e.target.value)}
                />
                <Button size="sm" onClick={() => requestConfirm(pack.size)}>
                  Save
                </Button>
              </div>
            ) : confirmingSize === pack.size ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-secondary">
                  Set to ${((pendingPriceCents ?? 0) / 100).toFixed(2)}?
                </span>
                <Button size="sm" disabled={isSaving} onClick={() => confirmSave(pack.size)}>
                  Confirm
                </Button>
                <Button variant="secondary" size="sm" disabled={isSaving} onClick={() => cancelConfirm(pack.size)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {saved === pack.size && <span className="text-xs font-bold text-success">Saved!</span>}
                <span className="font-bold text-text-heading">${(pack.priceCents / 100).toFixed(2)} NZD</span>
                <Button variant="secondary" size="sm" onClick={() => startEdit(pack)}>
                  Edit
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
