import Stripe from 'stripe';

export interface StripeCheckoutSession {
  id: string;
  url: string;
}

export type StripeCheckoutStatus = 'paid' | 'unpaid' | 'expired';

export interface StripeClient {
  createCheckoutSession(params: {
    amountCents: number;
    currency: string;
    productName: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }): Promise<StripeCheckoutSession>;
  getCheckoutSessionStatus(sessionId: string): Promise<StripeCheckoutStatus>;
}

// Real implementation — requires STRIPE_SECRET_KEY (a Stripe test-mode
// secret key is enough for local verification; this code can't fabricate
// real Stripe credentials).
export const realStripeClient: StripeClient = {
  async createCheckoutSession(params) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set');
    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: params.currency,
            product_data: { name: params.productName },
            unit_amount: params.amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { id: session.id, url: session.url };
  },

  async getCheckoutSessionStatus(sessionId) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set');
    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') return 'paid';
    if (session.status === 'expired') return 'expired';
    return 'unpaid';
  },
};
