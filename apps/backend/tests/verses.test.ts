import { describe, expect, it } from 'vitest';

import { build } from '../src/server.js';

const baseConfig = {
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

describe('GET /v1/verses/by_key/:verseKey', () => {
  it('falls back to fixture when QUL is missing — Al-Fatiha 1', async () => {
    const app = await build(baseConfig);
    const res = await app.inject({ method: 'GET', url: '/v1/verses/by_key/1:1' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-qalaam-source']).toBe('fixture');
    const json = res.json() as Record<string, unknown>;
    expect(json['verseKey']).toBe('1:1');
    expect(json['textUthmani']).toContain('بِسْمِ');
    await app.close();
  });

  it('returns RFC 9457 problem-detail for malformed key', async () => {
    const app = await build(baseConfig);
    const res = await app.inject({ method: 'GET', url: '/v1/verses/by_key/abc' });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json() as Record<string, unknown>;
    expect(body['code']).toBe('qalaam.verse-key.invalid-format');
    await app.close();
  });

  it('returns 503 with "data not loaded" when fixture lacks the verse and QUL is missing', async () => {
    const app = await build(baseConfig);
    const res = await app.inject({ method: 'GET', url: '/v1/verses/by_key/2:1' });
    expect(res.statusCode).toBe(503);
    const body = res.json() as Record<string, unknown>;
    expect(body['code']).toBe('qalaam.data.not-loaded');
    expect(body['outcomeImpacted']).toBe('O-01');
    await app.close();
  });
});

describe('GET /v1/chapters/:id/verses', () => {
  it('returns Al-Fatiha (7 verses) from fixture', async () => {
    const app = await build(baseConfig);
    const res = await app.inject({ method: 'GET', url: '/v1/chapters/1/verses' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-qalaam-source']).toBe('fixture');
    const json = res.json() as { verses: { verseKey: string }[] };
    expect(json.verses).toHaveLength(7);
    expect(json.verses[0]?.verseKey).toBe('1:1');
    expect(json.verses[6]?.verseKey).toBe('1:7');
    await app.close();
  });

  it('rejects out-of-range surah with 400', async () => {
    const app = await build(baseConfig);
    const res = await app.inject({ method: 'GET', url: '/v1/chapters/200/verses' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
