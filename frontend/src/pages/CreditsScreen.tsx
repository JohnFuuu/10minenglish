import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { fetchCreditPacks, startPoliCheckout, startStripeCheckout, type CreditPack } from '../lib/api';

export function CreditsScreen() {
  const { token, account } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchCreditPacks(token).then((res) => {
      setPacks(res.packs);
      setSelectedSize(res.packs[0]?.size ?? null);
    });
  }, [token]);

  // Real Stripe/POLi checkout URLs are cross-origin (a hosted page on their
  // domain) and genuinely need a full browser navigation. In PAYMENTS_MOCK
  // mode the "checkout URL" points right back into our own app, so we can
  // navigate client-side instead — no full-page reload, no flicker.
  function goToCheckout(url: string) {
    if (new URL(url, window.location.origin).origin === window.location.origin) {
      navigate(url.replace(window.location.origin, ''));
    } else {
      window.location.href = url;
    }
  }

  async function handlePay(provider: 'stripe' | 'poli') {
    if (!selectedSize || !token) return;
    setIsPaying(true);
    try {
      if (provider === 'stripe') {
        const { checkoutUrl } = await startStripeCheckout(token, selectedSize);
        goToCheckout(checkoutUrl);
      } else {
        const { navigateUrl } = await startPoliCheckout(token, selectedSize);
        goToCheckout(navigateUrl);
      }
    } catch {
      showToast('Something went wrong starting your payment. Please try again.', 'error');
      setIsPaying(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-body">Buy Credits</h1>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="text-xs font-bold uppercase tracking-wide text-text-secondary"
        >
          Back
        </button>
      </div>

      <div className="mb-6 rounded-md border-2 border-b-[5px] border-brand-primary-border bg-brand-primary p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-accent-lime-light">Current balance</p>
        <p className="font-display text-4xl font-black text-text-inverse">{account?.credits ?? 0}</p>
        <p className="text-xs font-bold text-accent-lime-light">1 credit = 1 lesson</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {packs.map((pack) => (
          <button
            key={pack.size}
            type="button"
            onClick={() => setSelectedSize(pack.size)}
            className={
              selectedSize === pack.size
                ? 'rounded-md border-2 border-b-[4px] border-brand-primary-border bg-brand-primary p-4 text-left'
                : 'rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-4 text-left'
            }
          >
            <p
              className={
                selectedSize === pack.size
                  ? 'text-lg font-bold text-text-inverse'
                  : 'text-lg font-bold text-text-heading'
              }
            >
              {pack.size} credits
            </p>
            <p
              className={
                selectedSize === pack.size ? 'text-sm font-bold text-accent-lime-light' : 'text-sm font-bold text-text-secondary'
              }
            >
              ${(pack.priceCents / 100).toFixed(2)} NZD
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Button tone="blue" disabled={!selectedSize || isPaying} onClick={() => handlePay('stripe')}>
          Pay with Stripe
        </Button>
        {account?.isNZLocated && (
          <Button variant="secondary" tone="blue" disabled={!selectedSize || isPaying} onClick={() => handlePay('poli')}>
            Pay with POLi
          </Button>
        )}
      </div>
    </main>
  );
}
