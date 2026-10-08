import mongoose, { Schema } from 'mongoose';

export const LESSON_DURATION_MINUTES = 10;

export type LessonStatus = 'upcoming' | 'cancelled' | 'completed';

export interface LessonDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  buddyId: mongoose.Types.ObjectId;
  startTime: Date;
  durationMinutes: number;
  status: LessonStatus;
  meetingLink: string;
  // Credits charged when booked — what a cancellation refunds. Lessons from
  // before lesson prices existed read as 1 (the schema default).
  creditsCost: number;
  // Why the User cancelled, if they said (optional; shown to the Buddy).
  cancellationReason?: string;
  // Set when the pre-lesson reminder goes out; doubles as the claim that stops
  // a second sweep sending it again.
  reminderSentAt?: Date;
  createdAt: Date;
}

const lessonSchema = new Schema<LessonDocument>({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
  buddyId: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
  startTime: { type: Date, required: true },
  durationMinutes: { type: Number, required: true, default: LESSON_DURATION_MINUTES },
  status: { type: String, required: true, enum: ['upcoming', 'cancelled', 'completed'], default: 'upcoming' },
  meetingLink: { type: String, required: true },
  creditsCost: { type: Number, required: true, default: 1, min: 0 },
  cancellationReason: { type: String },
  reminderSentAt: { type: Date },
  createdAt: { type: Date, required: true, default: Date.now },
});

lessonSchema.index({ buddyId: 1, startTime: 1 });
lessonSchema.index({ userId: 1, startTime: 1 });

export const Lesson = mongoose.model<LessonDocument>('Lesson', lessonSchema);
