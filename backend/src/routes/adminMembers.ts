import { Router } from 'express';
import type { HydratedDocument, Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account, type AccountDocument } from '../models/Account.js';
import { Tag, tagNameKey, type TagDocument } from '../models/Tag.js';
import { accountLabel, recordAdminAction } from '../services/auditLog.js';

// Admin-only member tags (see docs/superpowers/specs/2026-10-05-admin-member-tags-design.md).
// Everything about tags lives behind these routes: no User- or Buddy-facing
// response includes them.
const adminOnly = [requireAuth, requireRole('admin')];

// Route params and filters come straight from the URL; anything that isn't a
// well-formed id is treated as "not found" instead of reaching Mongoose and
// failing as a CastError (500).
function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

function readTagName(body: unknown): string | null {
  const name = (body as { name?: unknown } | undefined)?.name;
  if (typeof name !== 'string' || name.trim() === '') return null;
  return name.trim();
}

async function memberCount(tagId: Types.ObjectId): Promise<number> {
  return Account.countDocuments({ role: 'user', 'memberTags.tagId': tagId });
}

function tagResponse(tag: TagDocument, count: number) {
  return { id: String(tag._id), name: tag.name, memberCount: count };
}

const MEMBER_LIST_LIMIT = 200;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Builds the Admin view of members in one pass: looks up every referenced
// Tag and Admin together rather than once per member.
async function memberResponses(members: HydratedDocument<AccountDocument>[]) {
  const tagIds = new Set<string>();
  const adminIds = new Set<string>();
  for (const member of members) {
    for (const entry of member.memberTags) {
      tagIds.add(String(entry.tagId));
      adminIds.add(String(entry.addedBy));
    }
  }
  const [tags, admins] = await Promise.all([
    Tag.find({ _id: { $in: [...tagIds] } }),
    Account.find({ _id: { $in: [...adminIds] } }, { name: 1, email: 1 }),
  ]);
  const tagById = new Map(tags.map((t) => [t.id as string, t]));
  const adminById = new Map(admins.map((a) => [a.id as string, a]));

  return members.map((member) => ({
    id: member.id as string,
    name: member.name,
    email: member.email,
    joinedAt: member._id.getTimestamp().toISOString(),
    credits: member.credits,
    tags: member.memberTags
      .filter((entry) => tagById.has(String(entry.tagId)))
      .map((entry) => {
        const addedBy = adminById.get(String(entry.addedBy));
        return {
          id: String(entry.tagId),
          name: tagById.get(String(entry.tagId))!.name,
          addedAt: entry.addedAt.toISOString(),
          addedBy: { id: String(entry.addedBy), name: addedBy?.name ?? addedBy?.email ?? 'Removed admin' },
        };
      }),
  }));
}

async function findMember(id: unknown) {
  return isObjectIdString(id) ? Account.findOne({ _id: id, role: 'user' }) : null;
}

export function createAdminMembersRouter(): Router {
  const router = Router();

  router.get('/api/admin/tags', ...adminOnly, async (_req, res) => {
    const tags = await Tag.find().sort({ nameKey: 1 });
    const counts = await Account.aggregate<{ _id: unknown; count: number }>([
      { $match: { role: 'user' } },
      { $unwind: '$memberTags' },
      { $group: { _id: '$memberTags.tagId', count: { $sum: 1 } } },
    ]);
    const countByTag = new Map(counts.map((c) => [String(c._id), c.count]));

    res.status(200).json({ tags: tags.map((tag) => tagResponse(tag, countByTag.get(String(tag._id)) ?? 0)) });
  });

  router.post('/api/admin/tags', ...adminOnly, async (req, res) => {
    const name = readTagName(req.body);
    if (!name) {
      res.status(400).json({ error: 'name cannot be empty' });
      return;
    }

    try {
      const tag = await Tag.create({ name, nameKey: tagNameKey(name) });
      await recordAdminAction(req.account!.accountId, 'tag.created', { type: 'tag', id: String(tag._id), label: tag.name });
      res.status(201).json(tagResponse(tag, 0));
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      res.status(409).json({ error: 'A tag with that name already exists' });
    }
  });

  router.patch('/api/admin/tags/:id', ...adminOnly, async (req, res) => {
    const tag = isObjectIdString(req.params.id) ? await Tag.findById(req.params.id) : null;
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    const name = readTagName(req.body);
    if (!name) {
      res.status(400).json({ error: 'name cannot be empty' });
      return;
    }

    const previousName = tag.name;
    tag.name = name;
    tag.nameKey = tagNameKey(name);
    try {
      await tag.save();
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      res.status(409).json({ error: 'A tag with that name already exists' });
      return;
    }

    if (previousName !== name) {
      await recordAdminAction(req.account!.accountId, 'tag.renamed', { type: 'tag', id: String(tag._id), label: name }, { from: previousName, to: name });
    }

    res.status(200).json(tagResponse(tag, await memberCount(tag._id)));
  });

  router.delete('/api/admin/tags/:id', ...adminOnly, async (req, res) => {
    const tag = isObjectIdString(req.params.id) ? await Tag.findById(req.params.id) : null;
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    // Untag everyone first, so no member is ever left pointing at a deleted tag.
    const result = await Account.updateMany(
      { 'memberTags.tagId': tag._id },
      { $pull: { memberTags: { tagId: tag._id } } },
    );
    await tag.deleteOne();
    await recordAdminAction(
      req.account!.accountId,
      'tag.deleted',
      { type: 'tag', id: String(tag._id), label: tag.name },
      { removedFromMembers: result.modifiedCount },
    );

    res.status(200).json({ removedFromMembers: result.modifiedCount });
  });

  router.get('/api/admin/members', ...adminOnly, async (req, res) => {
    const { q, tagId } = req.query;
    const filter: Record<string, unknown> = { role: 'user' };

    if (typeof q === 'string' && q.trim() !== '') {
      const pattern = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    if (tagId !== undefined && tagId !== '') {
      if (!isObjectIdString(tagId)) {
        res.status(200).json({ members: [] });
        return;
      }
      filter['memberTags.tagId'] = tagId;
    }

    const members = await Account.find(filter).sort({ _id: -1 }).limit(MEMBER_LIST_LIMIT);
    res.status(200).json({ members: await memberResponses(members) });
  });

  router.post('/api/admin/members/:id/tags', ...adminOnly, async (req, res) => {
    const { tagId } = req.body ?? {};
    const tag = isObjectIdString(tagId) ? await Tag.findById(tagId) : null;
    const member = await findMember(req.params.id);
    if (!member || !tag) {
      res.status(404).json({ error: member ? 'Tag not found' : 'Member not found' });
      return;
    }

    // One conditional update, so a double click or two Admins at once can
    // never add the same tag twice; an existing entry keeps its original
    // addedBy/addedAt.
    const result = await Account.updateOne(
      { _id: member._id, 'memberTags.tagId': { $ne: tag._id } },
      { $push: { memberTags: { tagId: tag._id, addedBy: req.account!.accountId, addedAt: new Date() } } },
    );
    if (result.modifiedCount > 0) {
      await recordAdminAction(
        req.account!.accountId,
        'member.tag_added',
        { type: 'member', id: String(member._id), label: accountLabel(member) },
        { tag: tag.name },
      );
    }

    const reloaded = await Account.findById(member._id);
    res.status(200).json((await memberResponses([reloaded!]))[0]);
  });

  router.delete('/api/admin/members/:id/tags/:tagId', ...adminOnly, async (req, res) => {
    const member = await findMember(req.params.id);
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    if (isObjectIdString(req.params.tagId)) {
      const result = await Account.updateOne({ _id: member._id }, { $pull: { memberTags: { tagId: req.params.tagId } } });
      if (result.modifiedCount > 0) {
        const tag = await Tag.findById(req.params.tagId);
        await recordAdminAction(
          req.account!.accountId,
          'member.tag_removed',
          { type: 'member', id: String(member._id), label: accountLabel(member) },
          { tag: tag?.name ?? 'deleted tag' },
        );
      }
    }

    const reloaded = await Account.findById(member._id);
    res.status(200).json((await memberResponses([reloaded!]))[0]);
  });

  return router;
}
