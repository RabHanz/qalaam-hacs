/* eslint-disable */
/**
 * QF Tier B PKCE + OIDC scaffold tests.
 *
 * Per ADR-0012 extension. Verifies the cryptographic surface (challenge
 * derivation + URL building) without hitting the network.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginPkceAsync,
  buildAuthorizeUrl,
  createQfUserApiClient,
  generatePkceChallenge,
  type QfTierBConfig,
} from '../src/qf/tier-b.js';

const TEST_CONFIG: QfTierBConfig = {
  authorizeUrl: 'https://oauth2.quran.foundation/authorize',
  tokenUrl: 'https://oauth2.quran.foundation/token',
  clientId: 'qalaam-test-client',
  redirectUri: 'https://qalaam.app/auth/qf/callback',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generatePkceChallenge', () => {
  it('produces a verifier ≥ 43 chars (RFC 7636 §4.1) and a different challenge', async () => {
    const c = await generatePkceChallenge();
    expect(c.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(c.codeChallenge.length).toBeGreaterThanOrEqual(43);
    expect(c.codeChallenge).not.toEqual(c.codeVerifier);
    expect(c.state.length).toBeGreaterThanOrEqual(16);
    // Must be URL-safe base64 — no '+', '/', or '=' padding.
    for (const s of [c.codeVerifier, c.codeChallenge, c.state]) {
      expect(s).not.toMatch(/[+/=]/);
    }
  });

  it('produces a fresh verifier on each call', async () => {
    const a = await generatePkceChallenge();
    const b = await generatePkceChallenge();
    expect(a.codeVerifier).not.toEqual(b.codeVerifier);
    expect(a.state).not.toEqual(b.state);
  });
});

describe('buildAuthorizeUrl', () => {
  it('encodes all PKCE + OIDC parameters with S256', async () => {
    const challenge = await generatePkceChallenge();
    const url = new URL(buildAuthorizeUrl(TEST_CONFIG, challenge));
    expect(url.origin).toBe('https://oauth2.quran.foundation');
    expect(url.pathname).toBe('/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('qalaam-test-client');
    expect(url.searchParams.get('redirect_uri')).toBe('https://qalaam.app/auth/qf/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(challenge.codeChallenge);
    expect(url.searchParams.get('state')).toBe(challenge.state);
    // Default scope includes openid + bookmarks.
    expect(url.searchParams.get('scope')).toContain('openid');
    expect(url.searchParams.get('scope')).toContain('bookmarks');
  });

  it('respects a caller-supplied scope override', async () => {
    const challenge = await generatePkceChallenge();
    const url = new URL(buildAuthorizeUrl({ ...TEST_CONFIG, scope: 'openid profile' }, challenge));
    expect(url.searchParams.get('scope')).toBe('openid profile');
  });
});

describe('beginPkceAsync', () => {
  it('returns a {url, challenge} pair where url contains the challenge', async () => {
    const { url, challenge } = await beginPkceAsync(TEST_CONFIG);
    expect(url).toContain(`code_challenge=${encodeURIComponent(challenge.codeChallenge)}`);
    expect(url).toContain(`state=${encodeURIComponent(challenge.state)}`);
  });
});

describe('createQfUserApiClient — not-provisioned guard', () => {
  it('throws qalaam.data.not-loaded for resource endpoints when no config', async () => {
    const client = createQfUserApiClient();
    await expect(client.listBookmarks()).rejects.toThrow(/Tier B/i);
    await expect(client.saveBookmark('1:1')).rejects.toThrow(/Tier B/i);
    await expect(client.listNotes()).rejects.toThrow(/Tier B/i);
  });

  it('exchangeCode hits the configured token endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'AT',
          refresh_token: 'RT',
          id_token: 'IDT',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const client = createQfUserApiClient({ config: TEST_CONFIG });
    const tokens = await client.exchangeCode({ code: 'XYZ', codeVerifier: 'VERIFIER' });
    expect(tokens.accessToken).toBe('AT');
    expect(tokens.refreshToken).toBe('RT');
    expect(tokens.idToken).toBe('IDT');
    expect(tokens.tokenType).toBe('Bearer');
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [calledUrl, init] = fetchSpy.mock.calls[0]! as [string, RequestInit];
    expect(calledUrl).toBe(TEST_CONFIG.tokenUrl);
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(init.body).toContain('grant_type=authorization_code');
    expect(init.body).toContain('code=XYZ');
    expect(init.body).toContain('code_verifier=VERIFIER');
  });

  it('exchangeCode throws on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));
    const client = createQfUserApiClient({ config: TEST_CONFIG });
    await expect(client.exchangeCode({ code: 'X', codeVerifier: 'Y' })).rejects.toThrow(
      /token exchange failed/i,
    );
  });

  it('refresh sends grant_type=refresh_token', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'AT2',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const client = createQfUserApiClient({ config: TEST_CONFIG });
    const tokens = await client.refresh({ refreshToken: 'RT-OLD' });
    expect(tokens.accessToken).toBe('AT2');
    expect(tokens.refreshToken).toBeNull();
    const [, init] = fetchSpy.mock.calls[0]! as [string, RequestInit];
    expect(init.body).toContain('grant_type=refresh_token');
    expect(init.body).toContain('refresh_token=RT-OLD');
  });
});
