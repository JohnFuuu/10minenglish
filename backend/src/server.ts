import 'dotenv/config';
import { createApp } from './app.js';
import { connectToDatabase } from './db.js';
import { mockPoliClient, mockStripeClient } from './services/mockPaymentClients.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const PAYMENTS_MOCK = process.env.PAYMENTS_MOCK === 'true';

if (!MONGODB_URI) throw new Error('MONGODB_URI is not set');
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set');

async function main() {
  await connectToDatabase(MONGODB_URI!);
  const app = createApp(
    PAYMENTS_MOCK ? { stripeClient: mockStripeClient, poliClient: mockPoliClient } : {},
  );
  if (PAYMENTS_MOCK) {
    console.log('PAYMENTS_MOCK=true — Stripe/POLi checkout will auto-succeed, no real provider calls.');
  }
  app.listen(PORT, () => {
    console.log(`10ME backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
