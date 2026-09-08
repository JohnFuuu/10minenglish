import mongoose from 'mongoose';
import { Router, type Request } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account, type AccountDocument, type AvailabilityBlock } from '../models/Account.js';
import { Lesson } from '../models/Lesson.js';
import { convertAvailabilityToTimezone } from '../services/availability.js';

export const buddyRouter = Router();

// A Buddy is only listed once they can actually be met (see ADR-0002): no
// Zoom link, no booking, so no point offering them in the directory.
const BOOKABLE_BUDDY_FILTER = {
  role: 'buddy',
  zoomLink: { $exists: true, $nin: [null, ''] },
} as const;

type HydratedAccount = mongoose.HydratedDocument<AccountDocument>;

function serializeBuddy(buddy: HydratedAccount, isFavourite: boolean) {
  return {
    id: buddy.id,
    name: buddy.name,
    picture: buddy.picture,
    bio: buddy.bio,
    location: buddy.location,
    isFavourite,
  };
}

async function favouriteIdsOf(accountId: string): Promise<Set<string>> {
  const account = await Account.findById(accountId).select('favouriteBuddyIds');
  return new Set((account?.favouriteBuddyIds ?? []).map((id) => id.toString()));
}

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

buddyRouter.get('/api/buddy/profile', requireAuth, requireRole('buddy'), async (req, res) => {
  const account = await Account.findById(req.account!.accountId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  res.status(200).json({
    id: account.id,
    name: account.name,
    email: account.email,
    picture: account.picture,
    bio: account.bio,
    location: account.location,
    timezone: account.timezone,
    zoomLink: account.zoomLink,
    availabilityBlocks: account.availabilityBlocks,
  });
});

buddyRouter.patch('/api/buddy/profile', requireAuth, requireRole('buddy'), async (req, res) => {
  const { name, picture, bio, location, timezone, zoomLink } = req.body ?? {};

  if (timezone !== undefined && !isValidTimezone(timezone)) {
    res.status(400).json({ error: 'Unrecognized timezone' });
    return;
  }

  const account = await Account.findById(req.account!.accountId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  if (name !== undefined) account.name = name;
  if (picture !== undefined) account.picture = picture;
  if (bio !== undefined) account.bio = bio;
  if (location !== undefined) account.location = location;
  if (timezone !== undefined) account.timezone = timezone;
  if (zoomLink !== undefined) account.zoomLink = zoomLink;
  await account.save();

  res.status(200).json({
    id: account.id,
    name: account.name,
    email: account.email,
    picture: account.picture,
    bio: account.bio,
    location: account.location,
    timezone: account.timezone,
    zoomLink: account.zoomLink,
    availabilityBlocks: account.availabilityBlocks,
  });
});

function isValidBlocks(blocks: unknown): blocks is AvailabilityBlock[] {
  return (
    Array.isArray(blocks) &&
    blocks.every(
      (b) =>
        b &&
        typeof b.dayOfWeek === 'number' &&
        b.dayOfWeek >= 0 &&
        b.dayOfWeek <= 6 &&
        typeof b.startTime === 'string' &&
        typeof b.endTime === 'string',
    )
  );
}

buddyRouter.put('/api/buddy/availability', requireAuth, requireRole('buddy'), async (req, res) => {
  const { blocks } = req.body ?? {};

  if (!isValidBlocks(blocks)) {
    res.status(400).json({ error: 'Invalid availability blocks' });
    return;
  }

  const account = await Account.findById(req.account!.accountId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  if (!account.timezone) {
    res.status(400).json({ error: 'Set a timezone before setting your availability' });
    return;
  }

  account.availabilityBlocks = blocks;
  await account.save();

  res.status(200).json({ availabilityBlocks: account.availabilityBlocks });
});

buddyRouter.get('/api/buddies/:id/availability', requireAuth, async (req, res) => {
  const viewerTimezone =
    typeof req.query.viewerTimezone === 'string' ? req.query.viewerTimezone : undefined;
  if (!viewerTimezone) {
    res.status(400).json({ error: 'Missing viewerTimezone query param' });
    return;
  }

  const buddy = await Account.findById(req.params.id);
  if (!buddy || buddy.role !== 'buddy') {
    res.status(404).json({ error: 'Buddy not found' });
    return;
  }

  if (!buddy.timezone) {
    res.status(200).json({ availabilityBlocks: [] });
    return;
  }

  const availabilityBlocks = convertAvailabilityToTimezone(
    buddy.availabilityBlocks,
    buddy.timezone,
    viewerTimezone,
  );
  res.status(200).json({ availabilityBlocks });
});

buddyRouter.get('/api/buddies', requireAuth, async (req, res) => {
  const buddies = await Account.find(BOOKABLE_BUDDY_FILTER);
  const favourites = await favouriteIdsOf(req.account!.accountId);

  res.status(200).json({
    buddies: buddies.map((b) => serializeBuddy(b, favourites.has(b.id))),
  });
});

// Buddies this User has already had a Lesson with, most recently taught first.
buddyRouter.get('/api/buddies/recent', requireAuth, requireRole('user'), async (req, res) => {
  const lessons = await Lesson.find({
    userId: req.account!.accountId,
    status: { $ne: 'cancelled' },
    startTime: { $lt: new Date() },
  }).sort({ startTime: -1 });

  // Sorted newest-first, so the first sighting of a Buddy is their most recent
  // Lesson; keep that order for the response.
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const lesson of lessons) {
    const id = lesson.buddyId.toString();
    if (!seen.has(id)) {
      seen.add(id);
      orderedIds.push(id);
    }
  }

  const buddies = await Account.find({ ...BOOKABLE_BUDDY_FILTER, _id: { $in: orderedIds } });
  const byId = new Map(buddies.map((b) => [b.id, b]));
  const favourites = await favouriteIdsOf(req.account!.accountId);

  res.status(200).json({
    buddies: orderedIds
      .map((id) => byId.get(id))
      .filter((b): b is HydratedAccount => Boolean(b))
      .map((b) => serializeBuddy(b, favourites.has(b.id))),
  });
});

buddyRouter.get('/api/buddies/favourites', requireAuth, requireRole('user'), async (req, res) => {
  const account = await Account.findById(req.account!.accountId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const buddies = await Account.find({
    ...BOOKABLE_BUDDY_FILTER,
    _id: { $in: account.favouriteBuddyIds },
  });

  res.status(200).json({ buddies: buddies.map((b) => serializeBuddy(b, true)) });
});

async function setFavourite(req: Request, favourited: boolean) {
  const buddy = await Account.findById(req.params.id);
  if (!buddy || buddy.role !== 'buddy') return null;

  const update = favourited
    ? { $addToSet: { favouriteBuddyIds: buddy._id } }
    : { $pull: { favouriteBuddyIds: buddy._id } };
  await Account.updateOne({ _id: req.account!.accountId }, update);
  return buddy;
}

buddyRouter.post('/api/buddies/:id/favourite', requireAuth, requireRole('user'), async (req, res) => {
  const buddy = await setFavourite(req, true);
  if (!buddy) {
    res.status(404).json({ error: 'Buddy not found' });
    return;
  }

  res.status(200).json({ favourited: true, buddy: serializeBuddy(buddy, true) });
});

buddyRouter.delete('/api/buddies/:id/favourite', requireAuth, requireRole('user'), async (req, res) => {
  const buddy = await setFavourite(req, false);
  if (!buddy) {
    res.status(404).json({ error: 'Buddy not found' });
    return;
  }

  res.status(200).json({ favourited: false, buddy: serializeBuddy(buddy, false) });
});

// Registered last, and only for real ids: '/api/buddies/available' is served by
// the lessons router, which mounts after this one, so a greedy ':id' here would
// swallow it.
buddyRouter.get('/api/buddies/:id', requireAuth, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    next();
    return;
  }

  const buddy = await Account.findById(req.params.id);
  if (!buddy || buddy.role !== 'buddy') {
    res.status(404).json({ error: 'Buddy not found' });
    return;
  }

  const favourites = await favouriteIdsOf(req.account!.accountId);
  res.status(200).json({
    ...serializeBuddy(buddy, favourites.has(buddy.id)),
    bookable: Boolean(buddy.zoomLink),
  });
});
