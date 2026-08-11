import type { StripeClient } from './stripeClient.js';
import type { PoliClient } from './poliClient.js';

// Dev-only "always succeeds" clients, enabled via PAYMENTS_MOCK=true. Skips
// the real hosted checkout page entirely — redirects straight back to our
// own /credits/return with a status that's already final, so the full
// checkout -> confirm -> credited flow can be clicked through end-to-end
// without real Stripe/POLi credentials. Never used by tests (those use
// their own Fake clients in test/testApp.ts) and never the default in
// createApp() — only wired in by server.ts when the env var is set.

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

let sessionCounter = 0;

export const mockStripeClient: StripeClient = {
  async createCheckoutSession() {
    sessionCounter += 1;
    const id = `mock_stripe_session_${Date.now()}_${sessionCounter}`;
    return {
      id,
      url: `${FRONTEND_URL}/credits/return?provider=stripe&session_id=${id}`,
    };
  },
  async getCheckoutSessionStatus() {
    return 'paid';
  },
};

let tokenCounter = 0;

export const mockPoliClient: PoliClient = {
  async initiateTransaction() {
    tokenCounter += 1;
    const token = `mock_poli_token_${Date.now()}_${tokenCounter}`;
    return {
      token,
      navigateUrl: `${FRONTEND_URL}/credits/return?provider=poli&token=${token}`,
    };
  },
  async getTransactionStatus() {
    return 'completed';
  },
};
