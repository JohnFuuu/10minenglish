import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account, type AvailabilityBlock } from '../models/Account.js';
import { convertAvailabilityToTimezone } from '../services/availability.js';

export const buddyRouter = Router();

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

buddyRouter.get('/api/buddies', requireAuth, async (_req, res) => {
  const buddies = await Account.find({
    role: 'buddy',
    zoomLink: { $exists: true, $nin: [null, ''] },
  });

  res.status(200).json({
    buddies: buddies.map((b) => ({
      id: b.id,
      name: b.name,
      picture: b.picture,
      bio: b.bio,
      location: b.location,
    })),
  });
});
