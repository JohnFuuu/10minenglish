import mongoose, { Schema } from 'mongoose';

export const CREDIT_PACK_SIZES = [1, 10, 20, 30] as const;
export type CreditPackSize = (typeof CREDIT_PACK_SIZES)[number];

// Single system-wide currency — NZD, matching the product's NZ base and
// letting Stripe and POLi charge the same denomination (see docs/adr/0004).
export const CREDIT_PACK_CURRENCY = 'nzd';

export interface CreditPackDocument extends mongoose.Document {
  // Named packSize, not size — "size" collides with Mongoose's
  // Query.prototype.size() cursor method and confuses filter type inference.
  packSize: CreditPackSize;
  priceCents: number;
}

const creditPackSchema = new Schema<CreditPackDocument>({
  packSize: { type: Number, required: true, unique: true, enum: CREDIT_PACK_SIZES },
  priceCents: { type: Number, required: true, min: 0 },
});

export const CreditPack = mongoose.model<CreditPackDocument>('CreditPack', creditPackSchema);

// Flat $1 (NZD) per credit — no bulk discount. Still just the starter price
// for a fresh install; an Admin can change any of these afterward without a
// deploy (see routes/creditPacks.ts's PATCH /api/admin/credit-packs/:size).
const DEFAULT_PRICES_CENTS: Record<CreditPackSize, number> = {
  1: 100,
  10: 1000,
  20: 2000,
  30: 3000,
};

// Seeds any missing pack sizes with a starter price — keeps GET /api/credit-packs
// working out of the box while still letting an Admin change prices afterward.
export async function ensureDefaultCreditPacks(): Promise<void> {
  for (const packSize of CREDIT_PACK_SIZES) {
    await CreditPack.updateOne(
      { packSize },
      { $setOnInsert: { packSize, priceCents: DEFAULT_PRICES_CENTS[packSize] } },
      { upsert: true },
    );
  }
}
