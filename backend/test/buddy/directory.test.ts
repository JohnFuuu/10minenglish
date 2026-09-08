import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Account } from '../../src/models/Account.js';
import { Lesson } from '../../src/models/Lesson.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

async function createUser() {
  const account = await Account.create({ role: 'user', email: 'sarah@example.com', credits: 5 });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

async function createBuddy(name: string, overrides: Record<string, unknown> = {}) {
  return Account.create({
    role: 'buddy',
    email: `${name.toLowerCase()}@example.com`,
    name,
    bio: `${name} loves teaching.`,
    location: 'Lisbon, Portugal',
    picture: `https://example.com/${name.toLowerCase()}.jpg`,
    zoomLink: 'https://zoom.us/j/1234567890',
    ...overrides,
  });
}

async function createPastLesson(userId: string, buddyId: string, daysAgo: number) {
  return Lesson.create({
    userId,
    buddyId,
    startTime: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    durationMinutes: 10,
    status: 'completed',
    zoomLink: 'https://zoom.us/j/1234567890',
  });
}

describe('GET /api/buddies', () => {
  it('lists bookable Buddies and flags which are favourited', async () => {
    const { account, token } = await createUser();
    const maria = await createBuddy('Maria');
    await createBuddy('Tom');
    await Account.updateOne({ _id: account.id }, { favouriteBuddyIds: [maria._id] });

    const app = createApp();
    const res = await request(app).get('/api/buddies').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.buddies).toHaveLength(2);
    const byName = Object.fromEntries(res.body.buddies.map((b: { name: string }) => [b.name, b]));
    expect(byName.Maria.isFavourite).toBe(true);
    expect(byName.Tom.isFavourite).toBe(false);
  });

  it('still excludes Buddies with no Zoom link', async () => {
    const { token } = await createUser();
    await createBuddy('Maria');
    await createBuddy('Nolink', { zoomLink: '' });

    const app = createApp();
    const res = await request(app).get('/api/buddies').set('Authorization', `Bearer ${token}`);

    expect(res.body.buddies.map((b: { name: string }) => b.name)).toEqual(['Maria']);
  });
});

describe('GET /api/buddies/recent', () => {
  it('lists Buddies the User has had a Lesson with, most recent first', async () => {
    const { account, token } = await createUser();
    const maria = await createBuddy('Maria');
    const tom = await createBuddy('Tom');
    await createBuddy('Never');

    await createPastLesson(account.id, tom.id, 10);
    await createPastLesson(account.id, maria.id, 2);

    const app = createApp();
    const res = await request(app)
      .get('/api/buddies/recent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.buddies.map((b: { name: string }) => b.name)).toEqual(['Maria', 'Tom']);
  });

  it('lists a Buddy once, however many Lessons they taught', async () => {
    const { account, token } = await createUser();
    const maria = await createBuddy('Maria');
    await createPastLesson(account.id, maria.id, 5);
    await createPastLesson(account.id, maria.id, 1);

    const app = createApp();
    const res = await request(app)
      .get('/api/buddies/recent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.buddies).toHaveLength(1);
  });

  it('ignores cancelled and still-upcoming Lessons', async () => {
    const { account, token } = await createUser();
    const cancelled = await createBuddy('Cancelled');
    const upcoming = await createBuddy('Upcoming');

    await Lesson.create({
      userId: account.id,
      buddyId: cancelled.id,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      durationMinutes: 10,
      status: 'cancelled',
      zoomLink: 'https://zoom.us/j/1234567890',
    });
    await Lesson.create({
      userId: account.id,
      buddyId: upcoming.id,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      durationMinutes: 10,
      status: 'upcoming',
      zoomLink: 'https://zoom.us/j/1234567890',
    });

    const app = createApp();
    const res = await request(app)
      .get('/api/buddies/recent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.buddies).toEqual([]);
  });
});

describe('favouriting a Buddy', () => {
  it('adds the Buddy to the favourites list', async () => {
    const { token } = await createUser();
    const maria = await createBuddy('Maria');

    const app = createApp();
    const res = await request(app)
      .post(`/api/buddies/${maria.id}/favourite`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.favourited).toBe(true);

    const list = await request(app)
      .get('/api/buddies/favourites')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.buddies.map((b: { name: string }) => b.name)).toEqual(['Maria']);
  });

  it('removes the Buddy again on unfavourite', async () => {
    const { token } = await createUser();
    const maria = await createBuddy('Maria');

    const app = createApp();
    await request(app)
      .post(`/api/buddies/${maria.id}/favourite`)
      .set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .delete(`/api/buddies/${maria.id}/favourite`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.favourited).toBe(false);

    const list = await request(app)
      .get('/api/buddies/favourites')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.buddies).toEqual([]);
  });

  it('favouriting twice leaves a single entry', async () => {
    const { token } = await createUser();
    const maria = await createBuddy('Maria');

    const app = createApp();
    await request(app)
      .post(`/api/buddies/${maria.id}/favourite`)
      .set('Authorization', `Bearer ${token}`);
    await request(app)
      .post(`/api/buddies/${maria.id}/favourite`)
      .set('Authorization', `Bearer ${token}`);

    const list = await request(app)
      .get('/api/buddies/favourites')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.buddies).toHaveLength(1);
  });

  it('rejects favouriting an account that is not a Buddy', async () => {
    const { token } = await createUser();
    const notABuddy = await Account.create({ role: 'user', email: 'someone@example.com' });

    const app = createApp();
    const res = await request(app)
      .post(`/api/buddies/${notABuddy.id}/favourite`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/buddies/:id', () => {
  it("returns the Buddy's page details", async () => {
    const { token } = await createUser();
    const maria = await createBuddy('Maria');

    const app = createApp();
    const res = await request(app)
      .get(`/api/buddies/${maria.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Maria',
      bio: 'Maria loves teaching.',
      location: 'Lisbon, Portugal',
      picture: 'https://example.com/maria.jpg',
      isFavourite: false,
      bookable: true,
    });
  });

  it('reports a Buddy with no Zoom link as not bookable', async () => {
    const { token } = await createUser();
    const nolink = await createBuddy('Nolink', { zoomLink: '' });

    const app = createApp();
    const res = await request(app)
      .get(`/api/buddies/${nolink.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.bookable).toBe(false);
  });

  it('404s for an account that is not a Buddy', async () => {
    const { token } = await createUser();
    const user = await Account.create({ role: 'user', email: 'someone@example.com' });

    const app = createApp();
    const res = await request(app)
      .get(`/api/buddies/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('does not swallow /api/buddies/available', async () => {
    const { token } = await createUser();
    await createBuddy('Maria');

    const app = createApp();
    const res = await request(app)
      .get(`/api/buddies/available?startTime=${new Date().toISOString()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('buddies');
  });
});
