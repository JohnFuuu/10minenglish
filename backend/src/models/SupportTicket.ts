import mongoose, { Schema } from 'mongoose';

// A member's or Buddy's request for help, handled by Admins on the SUPPORT
// tab. One back-and-forth thread per ticket: an Admin reply marks it
// `answered`, a sender reply sets it back to `open`, and an Admin can
// close (or reopen) it.
export const SUPPORT_TOPICS = ['payment', 'lesson', 'buddy', 'account', 'app', 'other'] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_STATUSES = ['open', 'answered', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const MAX_SUPPORT_MESSAGE_LENGTH = 2000;

export interface SupportMessage {
  from: 'sender' | 'admin';
  authorId: mongoose.Types.ObjectId;
  // Snapshotted, so the thread still reads right after a rename or removal.
  authorName: string;
  body: string;
  createdAt: Date;
}

export interface SupportTicketDocument extends mongoose.Document {
  senderId: mongoose.Types.ObjectId;
  senderRole: 'user' | 'buddy';
  topic: SupportTopic;
  lessonId?: mongoose.Types.ObjectId;
  status: SupportStatus;
  messages: SupportMessage[];
  createdAt: Date;
  // Bumped by every message, so lists show the most recently active first.
  lastActivityAt: Date;
}

const messageSchema = new Schema<SupportMessage>(
  {
    from: { type: String, required: true, enum: ['sender', 'admin'] },
    authorId: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
    authorName: { type: String, required: true },
    body: { type: String, required: true, maxlength: MAX_SUPPORT_MESSAGE_LENGTH },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const supportTicketSchema = new Schema<SupportTicketDocument>({
  senderId: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
  senderRole: { type: String, required: true, enum: ['user', 'buddy'] },
  topic: { type: String, required: true, enum: SUPPORT_TOPICS },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson' },
  status: { type: String, required: true, enum: SUPPORT_STATUSES, default: 'open' },
  messages: { type: [messageSchema], default: [] },
  createdAt: { type: Date, required: true, default: Date.now },
  lastActivityAt: { type: Date, required: true, default: Date.now },
});

supportTicketSchema.index({ senderId: 1, lastActivityAt: -1 });
supportTicketSchema.index({ status: 1, lastActivityAt: -1 });

export const SupportTicket = mongoose.model<SupportTicketDocument>('SupportTicket', supportTicketSchema);
