import { describe, expect, it } from 'vitest';

import { build } from '../src/server.js';

describe('GET /healthz', () => {
  it('returns ok', async () => {
    const app = await build({
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      PORT: 0,
      PUBLIC_API_URL: 'http://localhost',
      PUBLIC_APP_URL: 'http://localhost',
      DATABASE_URL: 'postgres://x:x@localhost/x',
      REDIS_URL: 'redis://localhost:6379',
      QUL_SQLITE_PATH: '/tmp/nonexistent-qul.sqlite',
      QF_BASE_URL: 'https://apis.quran.foundation',
      QF_OAUTH_URL: 'https://oauth2.quran.foundation',
    });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', version: '0.0.1' });
    await app.close();
  });
});

describe('error handling', () => {
  it('returns RFC 9457 problem-detail for unknown routes', async () => {
    const app = await build({
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      PORT: 0,
      PUBLIC_API_URL: 'http://localhost',
      PUBLIC_APP_URL: 'http://localhost',
      DATABASE_URL: 'postgres://x:x@localhost/x',
      REDIS_URL: 'redis://localhost:6379',
      QUL_SQLITE_PATH: '/tmp/nonexistent-qul.sqlite',
      QF_BASE_URL: 'https://apis.quran.foundation',
      QF_OAUTH_URL: 'https://oauth2.quran.foundation',
    });
    const res = await app.inject({ method: 'GET', url: '/not-a-route' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 404, title: 'Not Found' });
    await app.close();
  });
});
