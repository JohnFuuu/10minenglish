import mongoose, { Schema } from 'mongoose';

// Append-only record of Admin changes (see
// docs/superpowers/specs/2026-10-05-admin-audit-log-design.md). Nothing in
// the API updates or deletes these.
export const AUDIT_ACTIONS = [
  'tag.created',
  'tag.renamed',
  'tag.deleted',
  'member.tag_added',
  'member.tag_removed',
  'member.credits_awarded',
  'buddy.created',
  'buddy.activated',
  'buddy.deactivated',
  'buddy.removed',
  'price.changed',
  'lesson_price.changed',
  'admin.created',
  'admin.deactivated',
  'admin.activated',
  'admin.removed',
  'support.replied',
  'support.closed',
  'support.reopened',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditTargetType = 'tag' | 'member' | 'buddy' | 'creditPack' | 'lessonPrice' | 'admin' | 'supportTicket';

// The Audit log tab's filter options.
export const AUDIT_CATEGORIES: Record<string, AuditAction[]> = {
  tags: ['tag.created', 'tag.renamed', 'tag.deleted'],
  memberTags: ['member.tag_added', 'member.tag_removed'],
  credits: ['member.credits_awarded'],
  buddies: ['buddy.created', 'buddy.activated', 'buddy.deactivated', 'buddy.removed'],
  pricing: ['price.changed', 'lesson_price.changed'],
  admins: ['admin.created', 'admin.deactivated', 'admin.activated', 'admin.removed'],
  support: ['support.replied', 'support.closed', 'support.reopened'],
};

export interface AuditEntryDocument extends mongoose.Document {
  action: AuditAction;
  // Snapshotted at write time, so the entry still reads correctly after a
  // rename, a deletion, or an Admin account being removed.
  admin: { id: mongoose.Types.ObjectId; name: string };
  target: { type: AuditTargetType; id?: string; label: string };
  details: Record<string, unknown>;
  createdAt: Date;
}

const adminSnapshotSchema = new Schema(
  { id: { type: Schema.Types.ObjectId, required: true }, name: { type: String, required: true } },
  { _id: false },
);

const targetSnapshotSchema = new Schema(
  {
    type: { type: String, required: true, enum: ['tag', 'member', 'buddy', 'creditPack', 'lessonPrice', 'admin', 'supportTicket'] },
    id: { type: String },
    label: { type: String, required: true },
  },
  { _id: false },
);

const auditEntrySchema = new Schema<AuditEntryDocument>(
  {
    action: { type: String, required: true, enum: AUDIT_ACTIONS },
    admin: { type: adminSnapshotSchema, required: true },
    target: { type: targetSnapshotSchema, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  // Keep `details: {}` rather than dropping the empty object.
  { minimize: false },
);

export const AuditEntry = mongoose.model<AuditEntryDocument>('AuditEntry', auditEntrySchema);
