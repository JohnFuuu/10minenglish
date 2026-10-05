import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createFacebookAuthClient } from '../../src/services/facebookAuth.js';

// Stands in for Facebook's servers: answers the code exchange, then the
// profile lookup, and records each request.
function fakeGraph(responses: { status: number; body: unknown }[]) {
  const urls: URL[] = [];
  const fetchFn = async (url: string | URL | Request) => {
    urls.push(new URL(String(url)));
    const next = responses.shift()!;
    return new Response(JSON.stringify(next.body), { status: next.status });
  };
  return { urls, fetchFn: fetchFn as typeof fetch };
}

const config = {
  appId: 'app-1',
  appSecret: 'shh',
  redirectUri: 'http://localhost:5173/auth/facebook/callback',
};

describe('Facebook auth client', () => {
  it('exchanges the code for a token, then reads the profile with it', async () => {
    const { urls, fetchFn } = fakeGraph([
      { status: 200, body: { access_token: 'user-token', token_type: 'bearer', expires_in: 5000 } },
      { status: 200, body: { id: 'fb-123', name: 'Sarah Lee', email: 'sarah@example.com' } },
    ]);
    const client = createFacebookAuthClient({ ...config, fetchFn });

    const profile = await client.exchangeCode('the-code');

    expect(profile).toEqual({ facebookId: 'fb-123', name: 'Sarah Lee', email: 'sarah@example.com' });
    const [exchange, me] = urls;
    expect(exchange.pathname).toMatch(/\/oauth\/access_token$/);
    expect(Object.fromEntries(exchange.searchParams)).toEqual({
      client_id: 'app-1',
      client_secret: 'shh',
      redirect_uri: 'http://localhost:5173/auth/facebook/callback',
      code: 'the-code',
    });
    expect(me.pathname).toMatch(/\/me$/);
    expect(me.searchParams.get('fields')).toBe('id,name,email');
    expect(me.searchParams.get('access_token')).toBe('user-token');
    expect(me.searchParams.get('appsecret_proof')).toBe(createHmac('sha256', 'shh').update('user-token').digest('hex'));
  });

  it('returns no email when Facebook does not share one', async () => {
    const { fetchFn } = fakeGraph([
      { status: 200, body: { access_token: 'user-token' } },
      { status: 200, body: { id: 'fb-456', name: 'Phone Only' } },
    ]);
    const client = createFacebookAuthClient({ ...config, fetchFn });

    const profile = await client.exchangeCode('the-code');

    expect(profile.email).toBeUndefined();
  });

  it('rejects when Facebook refuses the code', async () => {
    const { fetchFn } = fakeGraph([
      { status: 400, body: { error: { message: 'This authorization code has expired.' } } },
    ]);
    const client = createFacebookAuthClient({ ...config, fetchFn });

    await expect(client.exchangeCode('old-code')).rejects.toThrow(/expired/);
  });
});
