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

      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">Choose a pack</p>
      <div className="mb-6 flex flex-col gap-2.5">
        {packs.map((pack) => {
          const selected = selectedSize === pack.size;
          return (
            <button
              key={pack.size}
              type="button"
              onClick={() => setSelectedSize(pack.size)}
              className={
                selected
                  ? 'flex items-center justify-between rounded-md border-2 border-b-4 border-brand-primary-border bg-success-bg p-4'
                  : 'flex items-center justify-between rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-4'
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className={
                    selected
                      ? 'flex h-10 w-10 items-center justify-center rounded-md border-2 border-accent-lime bg-accent-lime-light text-sm font-bold text-success'
                      : 'flex h-10 w-10 items-center justify-center rounded-md border-2 border-border text-sm font-bold text-text-heading'
                  }
                >
                  {pack.size}
                </span>
                <div className="text-left">
                  <p className="text-sm font-bold uppercase tracking-widest text-text-heading">
                    {pack.size} credit{pack.size > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-text-secondary">
                    ${(pack.priceCents / pack.size / 100).toFixed(2)} per credit
                  </p>
                </div>
              </div>
              <p className="text-base font-bold text-text-heading">${(pack.priceCents / 100).toFixed(2)}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <Button tone="blue" disabled={!selectedSize || isPaying} onClick={() => handlePay('stripe')}>
          {isPaying ? 'Processing…' : 'Pay with Stripe'}
        </Button>
        {account?.isNZLocated && (
          <Button variant="secondary" tone="blue" disabled={!selectedSize || isPaying} onClick={() => handlePay('poli')}>
            {isPaying ? 'Processing…' : 'Pay with POLi'}
          </Button>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-text-secondary">
        Payments are processed securely. Credits added instantly.
      </p>
    </main>
  );
}
