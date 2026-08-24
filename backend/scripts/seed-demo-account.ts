import 'dotenv/config';
import { connectToDatabase } from '../src/db.js';
import { Account } from '../src/models/Account.js';
import { hashPassword } from '../src/services/password.js';

async function main() {
  await connectToDatabase(process.env.MONGODB_URI!);

  const email = 'demo-user@10me.test';
  const password = 'DemoPass123!';
  await Account.deleteOne({ email });
  await Account.create({
    role: 'user',
    email,
    name: 'Demo User',
    passwordHash: await hashPassword(password),
    credits: 10,
    emailConfirmed: true,
    onboardingCompleted: true,
    location: 'New Zealand',
  });

  const buddyEmail = 'demo-buddy@10me.test';
  await Account.deleteOne({ email: buddyEmail });
  await Account.create({
    role: 'buddy',
    email: buddyEmail,
    name: 'Demo Buddy',
    passwordHash: await hashPassword(password),
    emailConfirmed: true,
    timezone: 'Pacific/Auckland',
    zoomLink: 'https://zoom.us/j/demo123',
    bio: 'Friendly demo Buddy, available almost any time for testing.',
    availabilityBlocks: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      startTime: '07:00',
      endTime: '22:00',
    })),
  });

  console.log(`User login:  ${email} / ${password}`);
  console.log(`Buddy login: ${buddyEmail} / ${password}`);
  console.log('Buddy is available 07:00-22:00 every day (Pacific/Auckland) so most times you pick should show as bookable.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
