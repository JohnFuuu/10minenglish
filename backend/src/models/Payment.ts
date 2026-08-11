import mongoose, { Schema } from 'mongoose';
import type { CreditPackSize } from './CreditPack.js';

export type PaymentProvider = 'stripe' | 'poli';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

export interface PaymentDocument extends mongoose.Document {
  accountId: mongoose.Types.ObjectId;
  provider: PaymentProvider;
  packSize: CreditPackSize;
  priceCentsAtPurchase: number;
  status: PaymentStatus;
  providerReference: string;
  createdAt: Date;
}

const paymentSchema = new Schema<PaymentDocument>({
  accountId: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
  provider: { type: String, required: true, enum: ['stripe', 'poli'] },
  packSize: { type: Number, required: true },
  priceCentsAtPurchase: { type: Number, required: true },
  status: { type: String, required: true, enum: ['pending', 'succeeded', 'failed'], default: 'pending' },
  providerReference: { type: String, required: true, unique: true },
  createdAt: { type: Date, required: true, default: Date.now },
});

export const Payment = mongoose.model<PaymentDocument>('Payment', paymentSchema);
