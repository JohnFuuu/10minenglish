import { Router } from 'express';
import type { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import { Tag, tagNameKey, type TagDocument } from '../models/Tag.js';

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

    tag.name = name;
    tag.nameKey = tagNameKey(name);
    try {
      await tag.save();
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      res.status(409).json({ error: 'A tag with that name already exists' });
      return;
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

    res.status(200).json({ removedFromMembers: result.modifiedCount });
  });

  return router;
}
