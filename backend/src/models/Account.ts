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
  // Absent only for a Facebook sign-up that shared no email; such an account
  // can't book or buy Credits until it adds and confirms one.
  email?: string;
  // Set while a profile email change is awaiting confirmation; the account
  // keeps logging in with `email` until the new address is confirmed.
  pendingEmail?: string;
  name?: string;
  passwordHash?: string;
  phoneNumber?: string;
  location?: string;
  nationality?: string;
  dateOfBirth?: Date;
  learningGoals?: string[];
  learningGoalOther?: string;
  googleId?: string;
  facebookId?: string;
  picture?: string;
  bio?: string;
  timezone?: string;
  meetingLink?: string;
  availabilityBlocks: AvailabilityBlock[];
  // Admin-only labels from the managed Tag list (User accounts only). Never
  // returned by any User- or Buddy-facing route — see routes/adminMembers.ts.
  memberTags: { tagId: mongoose.Types.ObjectId; addedBy: mongoose.Types.ObjectId; addedAt: Date }[];
  // Buddies this User has favourited. Only ever set on User accounts.
  favouriteBuddyIds: mongoose.Types.ObjectId[];
  // Admin-controlled, and only meaningful for Buddy accounts: an inactive
  // Buddy is out of rotation but keeps their account and profile.
  active: boolean;
  // Set when an Admin removes (archives) a Buddy: kept for Lesson history and
  // the audit log, but locked out and hidden from every roster/directory.
  removedAt?: Date;
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
  credits: number;
  // Payments whose credits are already on this balance — the guard that
  // lets confirming a payment twice (or at once) add its credits only once.
  creditedPaymentIds: mongoose.Types.ObjectId[];
}

const accountSchema = new Schema<AccountDocument>({
  role: { type: String, enum: ['user', 'buddy', 'admin'], required: true },
  // sparse: uniqueness applies only to accounts that have an email, so any
  // number of email-less accounts can exist.
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  pendingEmail: { type: String, lowercase: true, trim: true },
  name: { type: String },
  passwordHash: { type: String },
  phoneNumber: { type: String },
  location: { type: String },
  nationality: { type: String },
  dateOfBirth: { type: Date },
  learningGoals: { type: [String] },
  learningGoalOther: { type: String },
  googleId: { type: String },
  facebookId: { type: String },
  picture: { type: String },
  bio: { type: String },
  timezone: { type: String },
  meetingLink: { type: String },
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
  memberTags: {
    type: [
      {
        tagId: { type: Schema.Types.ObjectId, ref: 'Tag', required: true },
        // The Admin who added it, and when — the spec's audit trail.
        addedBy: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
        addedAt: { type: Date, required: true },
        _id: false,
      },
    ],
    default: [],
  },
  favouriteBuddyIds: {
    type: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
    required: true,
    default: [],
  },
  active: { type: Boolean, required: true, default: true },
  removedAt: { type: Date },
  emailConfirmed: { type: Boolean, required: true, default: false },
  emailConfirmationToken: { type: String },
  emailConfirmationExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  failedLoginAttempts: { type: Number, required: true, default: 0 },
  lockedUntil: { type: Date },
  onboardingCompleted: { type: Boolean, required: true, default: false },
  referralSource: { type: String },
  selfRatedLevel: { type: Number, min: 1, max: 7 },
  motivation: { type: String },
  lessonsPerWeekGoal: { type: String },
  credits: { type: Number, required: true, default: 0 },
  creditedPaymentIds: { type: [Schema.Types.ObjectId], default: [] },
});

export const Account = mongoose.model<AccountDocument>('Account', accountSchema);
