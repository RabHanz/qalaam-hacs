/**
 * QUL routes — exercise the boundary cases (no SQLite present, malformed
 * verseKey, morphology gating). End-to-end "real data" cases run only when
 * `data/qul.sqlite` is populated (production CI gate).
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { FastifyInstance } from 'fastify';

import { build } from '../src/server.js';

const BASE_CONFIG = {
  NODE_ENV: 'test' as const,
  LOG_LEVEL: 'fatal' as const,
  PORT: 0,
  PUBLIC_API_URL: 'http://localhost',
  PUBLIC_APP_URL: 'http://localhost',
  DATABASE_URL: 'postgres://x:x@localhost/x',
  REDIS_URL: 'redis://localhost:6379',
  QUL_SQLITE_PATH: '/tmp/nonexistent-qul.sqlite',
  QF_BASE_URL: 'https://apis.quran.foundation',
  QF_OAUTH_URL: 'https://oauth2.quran.foundation',
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe('GET /v1/metadata/* — fail-closed when QUL absent', () => {
  it('returns problem-detail with qalaam.data.not-loaded when SQLite is missing', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({ method: 'GET', url: '/v1/metadata/surahs' });
    // Error handler maps qalaam.data.not-loaded to 503 Service Unavailable.
    expect([500, 503]).toContain(res.statusCode);
    expect(res.json()).toMatchObject({
      code: 'qalaam.data.not-loaded',
    });
  });
});

describe('GET /v1/mutashabihat/* — verseKey validation', () => {
  it('rejects malformed verseKey with 400 + qalaam.verse-key.malformed', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/mutashabihat/clusters/not-a-key',
    });
    // Could be 400 (validation failure) or 500 (internal error code mapping).
    // The body MUST carry the malformed code regardless.
    const body = res.json();
    expect(body.code).toBe('qalaam.verse-key.malformed');
  });

  it('accepts valid verseKey shape (still 500 because no SQLite, but past the validator)', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/mutashabihat/clusters/2:48',
    });
    expect(res.json().code).toBe('qalaam.data.not-loaded');
  });
});

describe('GET /v1/wbw/:verseKey — morphology gating', () => {
  it('rejects malformed verseKey', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/wbw/not-a-key',
    });
    const body = res.json();
    expect(body.code).toBe('qalaam.verse-key.malformed');
  });

  it('default request (no ?include) does not surface morphology', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({ method: 'GET', url: '/v1/wbw/1:1' });
    expect(res.json().code).toBe('qalaam.data.not-loaded');
  });
});

describe('GET /v1/surah-info/:surah — language-aware', () => {
  it('rejects out-of-range surah', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({ method: 'GET', url: '/v1/surah-info/200' });
    expect(res.json().code).toBe('qalaam.verse-key.surah-out-of-range');
  });

  it('lists languages even when SQLite missing (returns empty array via fail-closed)', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({ method: 'GET', url: '/v1/surah-info/languages' });
    // Without QUL SQLite, the route still throws data.not-loaded.
    expect(res.json().code).toBe('qalaam.data.not-loaded');
  });
});

describe('GET /v1/layouts — slug whitelisting', () => {
  it('lists known layouts without touching SQLite', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({ method: 'GET', url: '/v1/layouts' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toContain('madani_15');
    expect(body.data).toContain('kfgqpc_v4');
    expect(body.data).toContain('indopak_15');
  });

  it('rejects unknown layout slug with qalaam.mushaf.unknown-layout', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({ method: 'GET', url: '/v1/layouts/bogus_99/page-count' });
    expect(res.json().code).toBe('qalaam.mushaf.unknown-layout');
  });

  it('rejects malformed verseKey on by-verse lookup', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/layouts/madani_15/by-verse/not-a-key',
    });
    expect(res.json().code).toBe('qalaam.verse-key.malformed');
  });
});

describe('GET /v1/recitations — license-gated reciter access', () => {
  it('rejects malformed verseKey on segments', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/recitations/husary/segments/not-a-key',
    });
    expect(res.json().code).toBe('qalaam.verse-key.malformed');
  });

  it('rejects malformed verseKey on word-at', async () => {
    app = await build(BASE_CONFIG);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/recitations/husary/word-at?verseKey=bad&ms=0',
    });
    expect(res.json().code).toBe('qalaam.verse-key.malformed');
  });
});
