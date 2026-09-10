import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import type { MediaStorage } from '../services/mediaStorage.js';

export interface MediaRouterDependencies {
  mediaStorage: MediaStorage;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export function createMediaRouter(deps: MediaRouterDependencies): Router {
  const { mediaStorage } = deps;
  const router = Router();

  // Shared across roles — a profile picture means the same thing for a User
  // or a Buddy account, and both already store it in the same Account.picture
  // field (see models/Account.ts), so one upload endpoint covers both instead
  // of duplicating this in the User and Buddy profile routers.
  router.post('/api/me/picture', requireAuth, upload.single('picture'), async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded (expected a "picture" field)' });
      return;
    }

    const extension = ALLOWED_CONTENT_TYPES[file.mimetype];
    if (!extension) {
      res.status(400).json({ error: 'Unsupported image type — use JPEG, PNG, WebP, or GIF' });
      return;
    }

    const key = `profile-pictures/${req.account!.accountId}-${Date.now()}.${extension}`;

    let url: string;
    try {
      const result = await mediaStorage.upload({ key, body: file.buffer, contentType: file.mimetype });
      url = result.url;
    } catch (err) {
      console.error('Picture upload failed', err);
      res.status(502).json({ error: 'Could not upload the picture. Please try again.' });
      return;
    }

    const account = await Account.findById(req.account!.accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    account.picture = url;
    await account.save();

    res.status(200).json({ picture: url });
  });

  // multer throws (rather than calling next(err)) for limit violations —
  // this catches that and the "unsupported type" 400 above into one shape.
  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Image must be 5MB or smaller' });
      return;
    }
    next(err);
  });

  return router;
}
