import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import {
  CREDIT_PACK_CURRENCY,
  CREDIT_PACK_SIZES,
  CreditPack,
  ensureDefaultCreditPacks,
  type CreditPackSize,
} from '../models/CreditPack.js';
import { Payment } from '../models/Payment.js';
import type { StripeClient } from '../services/stripeClient.js';
import type { PoliClient } from '../services/poliClient.js';
import { isLikelyNewZealand } from '../services/location.js';

export interface PaymentsRouterDependencies {
  stripeClient: StripeClient;
  poliClient: PoliClient;
}

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

function isValidPackSize(size: unknown): size is CreditPackSize {
  return typeof size === 'number' && CREDIT_PACK_SIZES.includes(size as CreditPackSize);
}

export function createPaymentsRouter(deps: PaymentsRouterDependencies): Router {
  const { stripeClient, poliClient } = deps;
  const router = Router();

  router.post(
    '/api/payments/stripe/checkout',
    requireAuth,
    requireRole('user'),
    async (req, res) => {
      const { packSize } = req.body ?? {};
      if (!isValidPackSize(packSize)) {
        res.status(400).json({ error: 'Invalid pack size' });
        return;
      }

      await ensureDefaultCreditPacks();
      const pack = await CreditPack.findOne({ packSize });
      if (!pack) {
        res.status(400).json({ error: 'Unknown pack size' });
        return;
      }

      const session = await stripeClient.createCheckoutSession({
        amountCents: pack.priceCents,
        currency: CREDIT_PACK_CURRENCY,
        productName: `${packSize} 10ME Credits`,
        successUrl: `${FRONTEND_URL}/credits/return?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${FRONTEND_URL}/credits`,
        metadata: { accountId: req.account!.accountId, packSize: String(packSize) },
      });

      await Payment.create({
        accountId: req.account!.accountId,
        provider: 'stripe',
        packSize,
        priceCentsAtPurchase: pack.priceCents,
        status: 'pending',
        providerReference: session.id,
      });

      res.status(200).json({ checkoutUrl: session.url, sessionId: session.id });
    },
  );

  router.post('/api/payments/stripe/confirm', requireAuth, async (req, res) => {
    const { sessionId } = req.body ?? {};
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    const payment = await Payment.findOne({ providerReference: sessionId, provider: 'stripe' });
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    if (payment.accountId.toString() !== req.account!.accountId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (payment.status === 'succeeded') {
      const account = await Account.findById(payment.accountId);
      res.status(200).json({ status: 'succeeded', credits: account!.credits });
      return;
    }

    const status = await stripeClient.getCheckoutSessionStatus(sessionId);
    if (status === 'paid') {
      payment.status = 'succeeded';
      await payment.save();
      const account = await Account.findByIdAndUpdate(
        payment.accountId,
        { $inc: { credits: payment.packSize } },
        { returnDocument: 'after' },
      );
      res.status(200).json({ status: 'succeeded', credits: account!.credits });
      return;
    }

    payment.status = 'failed';
    await payment.save();
    res.status(200).json({ status: 'failed' });
  });

  router.post('/api/payments/poli/checkout', requireAuth, requireRole('user'), async (req, res) => {
    const { packSize } = req.body ?? {};
    if (!isValidPackSize(packSize)) {
      res.status(400).json({ error: 'Invalid pack size' });
      return;
    }

    const account = await Account.findById(req.account!.accountId);
    if (!isLikelyNewZealand(account!.location)) {
      res.status(403).json({ error: 'POLi is only available to NZ-located Users' });
      return;
    }

    await ensureDefaultCreditPacks();
    const pack = await CreditPack.findOne({ packSize });
    if (!pack) {
      res.status(400).json({ error: 'Unknown pack size' });
      return;
    }

    const transaction = await poliClient.initiateTransaction({
      amountCents: pack.priceCents,
      currency: CREDIT_PACK_CURRENCY,
      merchantReference: `${req.account!.accountId}-${Date.now()}`,
      successUrl: `${FRONTEND_URL}/credits/return?provider=poli`,
      failureUrl: `${FRONTEND_URL}/credits`,
    });

    await Payment.create({
      accountId: req.account!.accountId,
      provider: 'poli',
      packSize,
      priceCentsAtPurchase: pack.priceCents,
      status: 'pending',
      providerReference: transaction.token,
    });

    res.status(200).json({ navigateUrl: transaction.navigateUrl, token: transaction.token });
  });

  router.post('/api/payments/poli/confirm', requireAuth, async (req, res) => {
    const { token } = req.body ?? {};
    if (!token) {
      res.status(400).json({ error: 'Missing token' });
      return;
    }

    const payment = await Payment.findOne({ providerReference: token, provider: 'poli' });
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    if (payment.accountId.toString() !== req.account!.accountId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (payment.status === 'succeeded') {
      const account = await Account.findById(payment.accountId);
      res.status(200).json({ status: 'succeeded', credits: account!.credits });
      return;
    }

    const status = await poliClient.getTransactionStatus(token);
    if (status === 'completed') {
      payment.status = 'succeeded';
      await payment.save();
      const account = await Account.findByIdAndUpdate(
        payment.accountId,
        { $inc: { credits: payment.packSize } },
        { returnDocument: 'after' },
      );
      res.status(200).json({ status: 'succeeded', credits: account!.credits });
      return;
    }
    if (status === 'failed') {
      payment.status = 'failed';
      await payment.save();
      res.status(200).json({ status: 'failed' });
      return;
    }

    res.status(200).json({ status: 'pending' });
  });

  return router;
}
