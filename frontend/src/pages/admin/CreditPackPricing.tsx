import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button, Input } from '../../components';
import { MODULE_FRAME, SectionHeading } from './SectionHeading';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { adminUpdateCreditPackPrice, fetchCreditPacks, type CreditPack } from '../../lib/api';

// Whole dollars or dollars-and-cents only — e.g. "9", "9.9", "9.99". Rejects
// negatives, letters, and anything past two decimal places.
const PRICE_FORMAT = /^\d+(\.\d{1,2})?$/;

// "25", "25.0" and "25.00" are the same price; anything malformed is null.
function toCents(text: string): number | null {
  const trimmed = text.trim();
  return PRICE_FORMAT.test(trimmed) ? Math.round(Number(trimmed) * 100) : null;
}

export function CreditPackPricing() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [editingSize, setEditingSize] = useState<number | null>(null);
  const [draftPrice, setDraftPrice] = useState('');
  const [confirmingSize, setConfirmingSize] = useState<number | null>(null);
  const [pendingPriceCents, setPendingPriceCents] = useState<number | null>(null);
  // The price typed a second time; Confirm stays disabled until it matches.
  const [retypedPrice, setRetypedPrice] = useState('');
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
  // row into a confirm state where the price must be typed again, since price
  // changes go live immediately (see AdminLayout's warning banner) and a
  // typo'd price would charge real Users the wrong amount.
  function requestConfirm(size: number) {
    const cents = toCents(draftPrice);
    if (cents === null) {
      showToast('Enter a valid price, e.g. 9.99.', 'error');
      return;
    }
    setPendingPriceCents(cents);
    setRetypedPrice('');
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
    <section className={`mb-10 ${MODULE_FRAME}`}>
      <div className="mb-1 flex items-center gap-2">
        <Wallet size={20} className="text-brand-secondary" aria-hidden="true" />
        <SectionHeading className="mb-0">Top-up packs</SectionHeading>
      </div>
      <p className="mb-4 text-sm font-medium text-text-secondary">
        What members <span className="font-bold text-text-body">pay</span>: the price in NZD for each credit pack on the
        Buy Credits screen.
      </p>

      <div className="flex flex-col gap-3">
        {packs.map((pack) => (
          <div
            key={pack.size}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-border bg-bg-surface p-3"
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
              <div className="flex w-full flex-col gap-2">
                <p className="text-sm font-bold text-text-body">
                  New price: ${((pendingPriceCents ?? 0) / 100).toFixed(2)} NZD. Type it again to confirm.
                </p>
                <Input
                  aria-label="Type the new price again"
                  placeholder="Type the new price again"
                  inputMode="decimal"
                  value={retypedPrice}
                  onChange={(e) => setRetypedPrice(e.target.value)}
                  autoFocus
                />
                {retypedPrice.trim() !== '' && toCents(retypedPrice) !== pendingPriceCents && (
                  <p className="text-xs font-bold text-error">Prices don't match</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    tone="red"
                    disabled={isSaving || toCents(retypedPrice) !== pendingPriceCents}
                    onClick={() => confirmSave(pack.size)}
                  >
                    Confirm
                  </Button>
                  <Button variant="secondary" size="sm" disabled={isSaving} onClick={() => cancelConfirm(pack.size)}>
                    Cancel
                  </Button>
                </div>
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
