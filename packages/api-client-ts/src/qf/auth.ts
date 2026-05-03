/**
 * Quran.Foundation OAuth2 client_credentials (Tier A).
 *
 * Per the QF docs:
 *  - Token endpoint: `${oauthUrl}/oauth2/token`
 *  - grant_type=client_credentials, scope=content
 *  - access tokens last 1 hour; no refresh tokens.
 *
 * We cache for 55 minutes to leave a 5-minute safety margin against clock skew
 * and request time. Concurrent callers share one in-flight request.
 */
import { QalaamError } from '@qalaam/core';

export interface QfAuthConfig {
  readonly oauthUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /** Override for tests / mock servers. */
  readonly fetchImpl?: typeof fetch;
  /** Token cache lifetime in ms. Defaults to 55 minutes. */
  readonly tokenLifetimeMs?: number;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface QfAuthClient {
  /** Returns a valid access token, refreshing in-band if needed. */
  getToken(): Promise<string>;
  /** Force-clear the cached token. Used after a 401. */
  invalidate(): void;
}

const DEFAULT_LIFETIME_MS = 55 * 60 * 1000;

export function createQfAuthClient(config: QfAuthConfig): QfAuthClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const lifetimeMs = config.tokenLifetimeMs ?? DEFAULT_LIFETIME_MS;
  let cachedToken: string | undefined;
  let cachedUntil = 0;
  let inflight: Promise<string> | undefined;

  async function fetchNew(): Promise<string> {
    const tokenUrl = `${config.oauthUrl.replace(/\/+$/, '')}/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'content',
    });
    const basic = btoa(`${config.clientId}:${config.clientSecret}`);
    const res = await fetchImpl(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `QF token endpoint returned ${res.status.toString()}: ${text}`,
      );
    }
    const json = (await res.json()) as TokenResponse;
    if (typeof json.access_token !== 'string' || json.access_token.length === 0) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        'QF token endpoint returned no access_token.',
      );
    }
    cachedToken = json.access_token;
    cachedUntil = Date.now() + Math.min(lifetimeMs, json.expires_in * 1000 - 60_000);
    return json.access_token;
  }

  return {
    async getToken(): Promise<string> {
      if (cachedToken && Date.now() < cachedUntil) return cachedToken;
      inflight ??= fetchNew().finally(() => {
        inflight = undefined;
      });
      return inflight;
    },
    invalidate(): void {
      cachedToken = undefined;
      cachedUntil = 0;
    },
  };
}
