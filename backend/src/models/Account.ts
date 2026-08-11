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

export interface AvailabilityBlock {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startTime: string; // "HH:MM", 24h
  endTime: string; // "HH:MM", 24h
}

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
  picture?: string;
  bio?: string;
  timezone?: string;
  zoomLink?: string;
  availabilityBlocks: AvailabilityBlock[];
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
  picture: { type: String },
  bio: { type: String },
  timezone: { type: String },
  zoomLink: { type: String },
  availabilityBlocks: {
    type: [
      {
        dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        _id: false,
      },
    ],
    required: true,
    default: [],
  },
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
