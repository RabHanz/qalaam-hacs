import { describe, expect, it, vi } from 'vitest';

import { createQfAuthClient } from '../src/qf/auth.js';

function makeFetchImpl(token: string, expiresIn: number, status = 200): typeof fetch {
  const fn = vi.fn(async () => {
    return new Response(
      JSON.stringify({ access_token: token, expires_in: expiresIn, token_type: 'Bearer' }),
      { status, headers: { 'content-type': 'application/json' } },
    );
  });
  return fn as unknown as typeof fetch;
}

describe('createQfAuthClient', () => {
  it('fetches and caches a token', async () => {
    const fetchImpl = makeFetchImpl('TOK', 3600);
    const auth = createQfAuthClient({
      oauthUrl: 'https://oauth.example',
      clientId: 'cid',
      clientSecret: 'csec',
      fetchImpl,
    });
    expect(await auth.getToken()).toBe('TOK');
    expect(await auth.getToken()).toBe('TOK'); // cached — no second call
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent requests into a single in-flight fetch', async () => {
    const fetchImpl = makeFetchImpl('TOK', 3600);
    const auth = createQfAuthClient({
      oauthUrl: 'https://oauth.example',
      clientId: 'cid',
      clientSecret: 'csec',
      fetchImpl,
    });
    await Promise.all([auth.getToken(), auth.getToken(), auth.getToken()]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('throws on non-200', async () => {
    const fetchImpl = makeFetchImpl('', 0, 500);
    const auth = createQfAuthClient({
      oauthUrl: 'https://oauth.example',
      clientId: 'cid',
      clientSecret: 'csec',
      fetchImpl,
    });
    await expect(auth.getToken()).rejects.toThrow();
  });

  it('invalidate() forces a refresh', async () => {
    const fetchImpl = makeFetchImpl('TOK', 3600);
    const auth = createQfAuthClient({
      oauthUrl: 'https://oauth.example',
      clientId: 'cid',
      clientSecret: 'csec',
      fetchImpl,
    });
    await auth.getToken();
    auth.invalidate();
    await auth.getToken();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
