import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Account } from '../src/models/Account.js';
import { signAccountToken } from '../src/middleware/auth.js';
import { clearTestDb, startTestDb, stopTestDb } from './dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const validAnswers = {
  referralSource: 'YouTube',
  selfRatedLevel: 3,
  lessonsPerWeekGoal: '3–4 conversations — steady progress',
};

describe('POST /api/onboarding', () => {
  it('rejects a request with no token', async () => {
    const app = createApp();
    const res = await request(app).post('/api/onboarding').send(validAnswers);

    expect(res.status).toBe(401);
  });

  it('saves the answers and marks onboarding complete', async () => {
    const account = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: account.id, role: account.role });

    const app = createApp();
    const res = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send(validAnswers);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ onboardingCompleted: true });

    const updated = await Account.findById(account.id);
    expect(updated!.onboardingCompleted).toBe(true);
    expect(updated!.referralSource).toBe('YouTube');
    expect(updated!.selfRatedLevel).toBe(3);
    expect(updated!.motivation).toBeUndefined();
    expect(updated!.lessonsPerWeekGoal).toBe('3–4 conversations — steady progress');
  });

  it('accepts a selfRatedLevel up to 7 (the new 7-tier scale)', async () => {
    const account = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: account.id, role: account.role });

    const app = createApp();
    const res = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAnswers, selfRatedLevel: 7 });

    expect(res.status).toBe(200);
    const updated = await Account.findById(account.id);
    expect(updated!.selfRatedLevel).toBe(7);
  });

  async function submitAs(answers: Record<string, unknown>) {
    const account = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: account.id, role: account.role });
    const res = await request(createApp())
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send(answers);
    return { res, updated: await Account.findById(account.id) };
  }

  it('saves the optional free-text detail when the referral source is Other', async () => {
    const { res, updated } = await submitAs({ ...validAnswers, referralSource: 'Other', referralSourceOther: '  A poster at my library  ' });

    expect(res.status).toBe(200);
    expect(updated!.referralSource).toBe('Other');
    expect(updated!.referralSourceOther).toBe('A poster at my library');
  });

  it('accepts Other with no detail (the text box is optional)', async () => {
    const { res, updated } = await submitAs({ ...validAnswers, referralSource: 'Other', referralSourceOther: '   ' });

    expect(res.status).toBe(200);
    expect(updated!.referralSource).toBe('Other');
    expect(updated!.referralSourceOther).toBeUndefined();
  });

  it('ignores the free-text detail when the referral source is not Other', async () => {
    const { updated } = await submitAs({ ...validAnswers, referralSourceOther: 'leftover text' });

    expect(updated!.referralSourceOther).toBeUndefined();
  });

  it('caps the free-text detail at 200 characters', async () => {
    const { updated } = await submitAs({ ...validAnswers, referralSource: 'Other', referralSourceOther: 'x'.repeat(500) });

    expect(updated!.referralSourceOther).toHaveLength(200);
  });

  it('rejects a request missing required answers', async () => {
    const account = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: account.id, role: account.role });

    const app = createApp();
    const res = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ referralSource: 'YouTube' });

    expect(res.status).toBe(400);
  });
});
