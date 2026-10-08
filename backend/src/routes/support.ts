import { Router, type Request } from 'express';
import type { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import { Lesson } from '../models/Lesson.js';
import {
  MAX_SUPPORT_MESSAGE_LENGTH,
  SUPPORT_STATUSES,
  SUPPORT_TOPICS,
  SupportTicket,
  type SupportStatus,
  type SupportTicketDocument,
} from '../models/SupportTicket.js';
import { accountLabel, recordAdminAction } from '../services/auditLog.js';
import type { EmailSender } from '../services/email.js';
import { createNotification } from '../services/notifications.js';

const ADMIN_PAGE_SIZE = 20;

const TOPIC_LABELS: Record<string, string> = {
  payment: 'Payment & credits',
  lesson: 'A lesson',
  buddy: 'My Buddy',
  account: 'My account',
  app: 'App problem',
  other: 'Other',
};

function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

// Trimmed message text, or null when it's empty, too long, or not text.
function readMessage(body: unknown): string | null {
  const message = (body as { message?: unknown } | undefined)?.message;
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  return trimmed && trimmed.length <= MAX_SUPPORT_MESSAGE_LENGTH ? trimmed : null;
}

// A ticket as the API returns it, with its lesson (if any) and — for the
// Admin queue — who sent it, looked up together for a whole list.
async function ticketResponses(tickets: SupportTicketDocument[]) {
  const lessonIds = tickets.flatMap((t) => (t.lessonId ? [t.lessonId] : []));
  const lessons = await Lesson.find({ _id: { $in: lessonIds } });
  const people = await Account.find(
    { _id: { $in: [...tickets.map((t) => t.senderId), ...lessons.map((l) => l.buddyId)] } },
    { name: 1, email: 1, role: 1 },
  );
  const personById = new Map(people.map((p) => [String(p._id), p]));
  const lessonById = new Map(lessons.map((l) => [String(l._id), l]));

  return tickets.map((t) => {
    const sender = personById.get(String(t.senderId));
    const lesson = t.lessonId ? lessonById.get(String(t.lessonId)) : undefined;
    return {
      id: String(t._id),
      topic: t.topic,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      lastActivityAt: t.lastActivityAt.toISOString(),
      sender: {
        id: String(t.senderId),
        role: t.senderRole,
        name: sender ? accountLabel(sender) : 'Removed account',
        email: sender?.email,
      },
      lesson: lesson
        ? {
            id: String(lesson._id),
            startTime: lesson.startTime.toISOString(),
            buddyName: personById.get(String(lesson.buddyId))?.name ?? 'Buddy',
          }
        : undefined,
      messages: t.messages.map((m) => ({
        from: m.from,
        authorName: m.authorName,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });
}

async function ticketResponse(ticket: SupportTicketDocument) {
  return (await ticketResponses([ticket]))[0];
}

// The ticket if this caller may see it: its sender, or any Admin.
async function findVisibleTicket(req: Request): Promise<SupportTicketDocument | null> {
  if (!isObjectIdString(req.params.id)) return null;
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return null;
  const { accountId, role } = req.account!;
  return role === 'admin' || String(ticket.senderId) === accountId ? ticket : null;
}

async function authorName(accountId: string): Promise<string> {
  const account = await Account.findById(accountId, { name: 1, email: 1 });
  return account ? accountLabel(account) : 'Unknown';
}

function supportTarget(ticket: SupportTicketDocument, senderName: string) {
  return { type: 'supportTicket' as const, id: String(ticket._id), label: `${TOPIC_LABELS[ticket.topic]} — ${senderName}` };
}

export function createSupportRouter({ emailSender }: { emailSender: EmailSender }): Router {
  const router = Router();

  router.post('/api/support/tickets', requireAuth, async (req, res) => {
    const { accountId, role } = req.account!;
    if (role !== 'user' && role !== 'buddy') {
      res.status(403).json({ error: 'Only members and Buddies send support tickets' });
      return;
    }
    const { topic, lessonId } = req.body ?? {};
    const message = readMessage(req.body);
    if (!SUPPORT_TOPICS.includes(topic) || !message) {
      res.status(400).json({ error: `Pick a topic and write a message (up to ${MAX_SUPPORT_MESSAGE_LENGTH} characters)` });
      return;
    }
    let lesson: Types.ObjectId | undefined;
    if (lessonId !== undefined && lessonId !== null && lessonId !== '') {
      const found = isObjectIdString(lessonId)
        ? await Lesson.findOne({ _id: lessonId, $or: [{ userId: accountId }, { buddyId: accountId }] })
        : null;
      if (!found) {
        res.status(400).json({ error: 'That lesson isn’t one of yours' });
        return;
      }
      lesson = found._id as Types.ObjectId;
    }

    const ticket = await SupportTicket.create({
      senderId: accountId,
      senderRole: role,
      topic,
      lessonId: lesson,
      messages: [{ from: 'sender', authorId: accountId, authorName: await authorName(accountId), body: message }],
    });
    res.status(201).json(await ticketResponse(ticket));
  });

  router.get('/api/support/tickets', requireAuth, async (req, res) => {
    const tickets = await SupportTicket.find({ senderId: req.account!.accountId }).sort({ lastActivityAt: -1 });
    res.status(200).json({ tickets: await ticketResponses(tickets) });
  });

  router.get('/api/support/tickets/:id', requireAuth, async (req, res) => {
    const ticket = await findVisibleTicket(req);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.status(200).json(await ticketResponse(ticket));
  });

  // A reply from the sender (sets it back to open, even if closed) or from an
  // Admin (marks it answered and tells the sender, in the app and by email).
  router.post('/api/support/tickets/:id/messages', requireAuth, async (req, res) => {
    const ticket = await findVisibleTicket(req);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    const message = readMessage(req.body);
    if (!message) {
      res.status(400).json({ error: `Write a message (up to ${MAX_SUPPORT_MESSAGE_LENGTH} characters)` });
      return;
    }

    const { accountId, role } = req.account!;
    const fromAdmin = role === 'admin';
    const now = new Date();
    const updated = await SupportTicket.findByIdAndUpdate(
      ticket._id,
      {
        $push: { messages: { from: fromAdmin ? 'admin' : 'sender', authorId: accountId, authorName: await authorName(accountId), body: message, createdAt: now } },
        $set: { status: fromAdmin ? 'answered' : 'open', lastActivityAt: now },
      },
      { returnDocument: 'after' },
    );

    if (fromAdmin) {
      const sender = await Account.findById(ticket.senderId);
      await recordAdminAction(accountId, 'support.replied', supportTarget(ticket, sender ? accountLabel(sender) : 'Removed account'));
      if (sender) {
        const topic = TOPIC_LABELS[ticket.topic];
        try {
          await createNotification({
            emailSender,
            accountId: sender._id,
            type: 'support_reply',
            message: `The 10 Minute English team replied to your question about “${topic}”: “${message}”`,
            details: { ticketId: String(ticket._id) },
            email: sender.email
              ? {
                  to: sender.email,
                  subject: `We replied to your question: ${topic}`,
                  body: [
                    `Hi ${sender.name ?? 'there'},`,
                    `We replied to your question about “${topic}”:`,
                    message,
                    'You can reply in the app (Help → your ticket) if you need more help.',
                    '— The 10 Minute English team',
                  ].join('\n\n'),
                }
              : undefined,
          });
        } catch (err) {
          // The reply is saved; a failed notice mustn't report it as failed.
          console.error('Failed to send support-reply notification', err);
        }
      }
    }

    res.status(201).json(await ticketResponse(updated!));
  });

  router.get('/api/admin/support/tickets', requireAuth, requireRole('admin'), async (req, res) => {
    const status = req.query.status;
    const filter: { status?: SupportStatus } = {};
    if (typeof status === 'string' && (SUPPORT_STATUSES as readonly string[]).includes(status)) filter.status = status as SupportStatus;
    const page = typeof req.query.page === 'string' && /^[1-9]\d*$/.test(req.query.page) ? Number(req.query.page) : 1;

    const [tickets, total, grouped] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ lastActivityAt: -1 })
        .skip((page - 1) * ADMIN_PAGE_SIZE)
        .limit(ADMIN_PAGE_SIZE),
      SupportTicket.countDocuments(filter),
      SupportTicket.aggregate<{ _id: SupportStatus; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    const counts = Object.fromEntries(SUPPORT_STATUSES.map((s) => [s, grouped.find((g) => g._id === s)?.n ?? 0]));

    res.status(200).json({ tickets: await ticketResponses(tickets), total, page, pageSize: ADMIN_PAGE_SIZE, counts });
  });

  // Close a handled ticket, or reopen one. "Answered" only comes from replying.
  router.patch('/api/admin/support/tickets/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { status } = req.body ?? {};
    if (status !== 'closed' && status !== 'open') {
      res.status(400).json({ error: 'status must be "closed" or "open"' });
      return;
    }
    const ticket = await findVisibleTicket(req);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    // Only an actual change is audited, even if two Admins click at once.
    const previous = await SupportTicket.findOneAndUpdate({ _id: ticket._id, status: { $ne: status } }, { $set: { status } });
    if (previous) {
      const sender = await Account.findById(ticket.senderId);
      await recordAdminAction(
        req.account!.accountId,
        status === 'closed' ? 'support.closed' : 'support.reopened',
        supportTarget(ticket, sender ? accountLabel(sender) : 'Removed account'),
      );
    }
    res.status(200).json(await ticketResponse((await SupportTicket.findById(ticket._id))!));
  });

  return router;
}
