import mongoose, { Schema } from 'mongoose';

export type AccountRole = 'user' | 'buddy' | 'admin';

export interface AccountDocument extends mongoose.Document {
  role: AccountRole;
  email: string;
}

const accountSchema = new Schema<AccountDocument>({
  role: { type: String, enum: ['user', 'buddy', 'admin'], required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
});

export const Account = mongoose.model<AccountDocument>('Account', accountSchema);
