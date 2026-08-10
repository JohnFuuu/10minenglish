import mongoose, { Schema } from 'mongoose';

export type AccountRole = 'user' | 'buddy' | 'admin';

export const LEARNING_GOALS = [
  'Build confidence speaking English',
  'Improve my pronunciation',
  'Practise real-life conversations',
  'Fix common grammar mistakes',
  'Expand my vocabulary',
  "Not sure yet – I'm exploring!",
  'Other',
] as const;

export interface AccountDocument extends mongoose.Document {
  role: AccountRole;
  email: string;
  name?: string;
  passwordHash?: string;
  phoneNumber?: string;
  location?: string;
  nationality?: string;
  dateOfBirth?: Date;
  learningGoals?: string[];
  learningGoalOther?: string;
  googleId?: string;
  emailConfirmed: boolean;
  emailConfirmationToken?: string;
  emailConfirmationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  onboardingCompleted: boolean;
  referralSource?: string;
  selfRatedLevel?: number;
  motivation?: string;
  lessonsPerWeekGoal?: string;
}

const accountSchema = new Schema<AccountDocument>({
  role: { type: String, enum: ['user', 'buddy', 'admin'], required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String },
  passwordHash: { type: String },
  phoneNumber: { type: String },
  location: { type: String },
  nationality: { type: String },
  dateOfBirth: { type: Date },
  learningGoals: { type: [String] },
  learningGoalOther: { type: String },
  googleId: { type: String },
  emailConfirmed: { type: Boolean, required: true, default: false },
  emailConfirmationToken: { type: String },
  emailConfirmationExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  failedLoginAttempts: { type: Number, required: true, default: 0 },
  lockedUntil: { type: Date },
  onboardingCompleted: { type: Boolean, required: true, default: false },
  referralSource: { type: String },
  selfRatedLevel: { type: Number, min: 1, max: 5 },
  motivation: { type: String },
  lessonsPerWeekGoal: { type: String },
});

export const Account = mongoose.model<AccountDocument>('Account', accountSchema);
