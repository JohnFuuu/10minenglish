import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  CREDIT_PACK_SIZES,
  CreditPack,
  ensureDefaultCreditPacks,
  type CreditPackSize,
} from '../models/CreditPack.js';

export const creditPacksRouter = Router();

creditPacksRouter.get('/api/credit-packs', requireAuth, async (_req, res) => {
  await ensureDefaultCreditPacks();
  const packs = await CreditPack.find().sort({ packSize: 1 });
  res.status(200).json({
    packs: packs.map((p) => ({ size: p.packSize, priceCents: p.priceCents })),
  });
});

creditPacksRouter.patch(
  '/api/admin/credit-packs/:size',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    const rawSize = Number(req.params.size);
    const { priceCents } = req.body ?? {};

    if (!CREDIT_PACK_SIZES.includes(rawSize as CreditPackSize)) {
      res.status(400).json({ error: 'Invalid pack size' });
      return;
    }
    if (typeof priceCents !== 'number' || priceCents < 0) {
      res.status(400).json({ error: 'Invalid priceCents' });
      return;
    }
    const packSize: CreditPackSize = rawSize as CreditPackSize;

    await ensureDefaultCreditPacks();
    const pack = await CreditPack.findOne({ packSize });
    if (!pack) {
      res.status(404).json({ error: 'Pack not found' });
      return;
    }
    pack.priceCents = priceCents;
    await pack.save();

    res.status(200).json({ size: pack.packSize, priceCents: pack.priceCents });
  },
);
