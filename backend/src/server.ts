import { createApp } from './app.js';
import { connectToDatabase } from './db.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI) throw new Error('MONGODB_URI is not set');
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set');

async function main() {
  await connectToDatabase(MONGODB_URI!);
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`10ME backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
