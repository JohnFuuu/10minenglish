import mongoose, { Schema } from 'mongoose';

// An Admin-managed label for Users (e.g. "low-income") that the User never
// sees. Members reference a Tag by id (Account.memberTags), so renaming a Tag
// here renames it everywhere, and a future rule (e.g. weekly vouchers) can
// rely on it.
export interface TagDocument extends mongoose.Document {
  name: string;
  // Trimmed, lowercased name — makes "Low-income" and "low-income" one tag.
  nameKey: string;
}

const tagSchema = new Schema<TagDocument>({
  name: { type: String, required: true, trim: true },
  nameKey: { type: String, required: true, unique: true },
});

export const Tag = mongoose.model<TagDocument>('Tag', tagSchema);

export function tagNameKey(name: string): string {
  return name.trim().toLowerCase();
}
