import 'dotenv/config';
import { connectToDatabase } from '../src/db.js';
import { Account } from '../src/models/Account.js';
import { Lesson } from '../src/models/Lesson.js';

// One-off: the Buddy/Lesson `zoomLink` field was renamed to `meetingLink`
// (see ADR 0002's update). Mongoose won't read the old key, so without this
// every existing Buddy looks link-less (and drops out of the bookable list)
// and every existing Lesson loses its Join link. Safe to re-run — only
// documents that still have `zoomLink` are touched.
async function main() {
  await connectToDatabase(process.env.MONGODB_URI!);

  const filter = { zoomLink: { $exists: true } };
  const update = { $rename: { zoomLink: 'meetingLink' } };
  const accounts = await Account.collection.updateMany(filter, update);
  const lessons = await Lesson.collection.updateMany(filter, update);

  console.log(`Accounts migrated: ${accounts.modifiedCount}`);
  console.log(`Lessons migrated:  ${lessons.modifiedCount}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
