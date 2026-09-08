import mongoose, { Schema } from 'mongoose';

export const LESSON_DURATION_MINUTES = 10;

export type LessonStatus = 'upcoming' | 'cancelled' | 'completed';

export interface LessonDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  buddyId: mongoose.Types.ObjectId;
  startTime: Date;
  durationMinutes: number;
  status: LessonStatus;
  zoomLink: string;
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
  zoomLink: { type: String, required: true },
  reminderSentAt: { type: Date },
  createdAt: { type: Date, required: true, default: Date.now },
});

lessonSchema.index({ buddyId: 1, startTime: 1 });
lessonSchema.index({ userId: 1, startTime: 1 });

export const Lesson = mongoose.model<LessonDocument>('Lesson', lessonSchema);
