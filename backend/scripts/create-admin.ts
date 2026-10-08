// Creates an Admin account directly in the database — for the very first
// Admin on a fresh deployment, since Admins are otherwise only added by
// another Admin (there's no Admin sign-up). Whether they're a super admin is
// decided by SUPER_BACKEND_ADMIN on the server, not here.
//
//   npx tsx scripts/create-admin.ts --email you@example.com --name "Your Name"
//
// Connects to MONGODB_URI (and MONGODB_DB_NAME, if set) from the environment
// or backend/.env. The password is typed in, hidden, and never echoed or
// accepted as an argument. Refuses to touch an email that's already
// registered, so it can't overwrite anyone.
import 'dotenv/config';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/db.js';
import { Account } from '../src/models/Account.js';
import { hashPassword } from '../src/services/password.js';

const MIN_PASSWORD_LENGTH = 12;

// Reads one line from the terminal without showing what's typed.
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void };
    let prompted = false;
    output._writeToOutput = (s: string) => {
      if (!prompted) {
        process.stdout.write(s);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  if (!email || !name) {
    console.error('Usage: npx tsx scripts/create-admin.ts --email you@example.com --name "Your Name"');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  const password = await askHidden(`Password for ${email} (hidden, at least ${MIN_PASSWORD_LENGTH} characters): `);
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Too short — use at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  if ((await askHidden('Type it again: ')) !== password) {
    console.error('The passwords don’t match. Nothing was created.');
    process.exit(1);
  }

  await connectToDatabase(process.env.MONGODB_URI);
  console.log(`Connected to database "${mongoose.connection.name}".`);

  const existing = await Account.findOne({ email });
  if (existing) {
    console.error(`${email} is already registered (as ${existing.role}). Nothing was changed.`);
    process.exit(1);
  }

  await Account.create({
    role: 'admin',
    name,
    email,
    passwordHash: await hashPassword(password),
    // Same as an Admin created from the app.
    emailConfirmed: true,
    onboardingCompleted: true,
  });
  console.log(`Created Admin ${name} <${email}>. Log in with that email and the password you typed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
