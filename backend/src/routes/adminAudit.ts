import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AUDIT_CATEGORIES, AuditEntry, type AuditEntryDocument } from '../models/AuditEntry.js';

const PAGE_SIZE = 50;
const EMPTY_PAGE = { entries: [], nextCursor: null };

function entryResponse(entry: AuditEntryDocument) {
  return {
    id: String(entry._id),
    action: entry.action,
    admin: { id: String(entry.admin.id), name: entry.admin.name },
    target: { type: entry.target.type, id: entry.target.id, label: entry.target.label },
    details: entry.details ?? {},
    createdAt: entry.createdAt.toISOString(),
  };
}

// Read-only on purpose: the audit log is append-only, so this is the only
// audit endpoint there is.
export function createAdminAuditRouter(): Router {
  const router = Router();

  router.get('/api/admin/audit-log', requireAuth, requireRole('admin'), async (req, res) => {
    const { category, before } = req.query;
    const filter: Record<string, unknown> = {};

    if (category !== undefined && category !== '') {
      // hasOwn, so "constructor"/"__proto__" can't resolve to a prototype value.
      if (typeof category !== 'string' || !Object.hasOwn(AUDIT_CATEGORIES, category)) {
        res.status(200).json(EMPTY_PAGE);
        return;
      }
      filter.action = { $in: AUDIT_CATEGORIES[category] };
    }
    if (before !== undefined && before !== '') {
      if (typeof before !== 'string' || !/^[a-f0-9]{24}$/i.test(before)) {
        res.status(200).json(EMPTY_PAGE);
        return;
      }
      filter._id = { $lt: new Types.ObjectId(before) };
    }

    // One extra row tells us whether another page follows.
    const found = await AuditEntry.find(filter).sort({ _id: -1 }).limit(PAGE_SIZE + 1);
    const page = found.slice(0, PAGE_SIZE);
    res.status(200).json({
      entries: page.map(entryResponse),
      nextCursor: found.length > PAGE_SIZE ? String(page[page.length - 1]._id) : null,
    });
  });

  return router;
}
