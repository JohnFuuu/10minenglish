import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { startTestDb, stopTestDb } from './dbTestSetup.js';

beforeAll(startTestDb, 30000);
afterAll(stopTestDb, 30000);

describe('GET /health', () => {
  it('returns ok when the database is connected', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'connected' });
  });
});
