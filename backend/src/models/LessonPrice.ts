import mongoose, { Schema } from 'mongoose';

// How many credits one Lesson costs: a single system-wide price an Admin can
// change without a deploy (like Credit Pack prices). Each Lesson records what
// it cost when booked (Lesson.creditsCost), so a later price change never
// alters what a cancellation refunds.
export const DEFAULT_CREDITS_PER_LESSON = 1;
export const MAX_CREDITS_PER_LESSON = 20;

export interface LessonPriceDocument extends mongoose.Document {
  key: 'global';
  creditsPerLesson: number;
}

const lessonPriceSchema = new Schema<LessonPriceDocument>({
  key: { type: String, required: true, unique: true, enum: ['global'] },
  creditsPerLesson: { type: Number, required: true, min: 1 },
});

export const LessonPrice = mongoose.model<LessonPriceDocument>('LessonPrice', lessonPriceSchema);

// The current price, seeding the default on first use.
export async function currentCreditsPerLesson(): Promise<number> {
  const price = await LessonPrice.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', creditsPerLesson: DEFAULT_CREDITS_PER_LESSON } },
    { upsert: true, returnDocument: 'after' },
  );
  return price!.creditsPerLesson;
}
