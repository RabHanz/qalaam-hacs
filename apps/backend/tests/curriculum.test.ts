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

describe('Curriculum routes', () => {
  it('lists 4 levels with their lessons', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({ method: 'GET', url: '/v1/curriculum/lessons' });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { levels: { level: number; lessons: unknown[] }[] };
    expect(body.levels).toHaveLength(4);
    expect(body.levels[0]?.lessons.length).toBeGreaterThan(20);
    await app.close();
  });

  it('serves a single lesson by `level/slug`', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({ method: 'GET', url: '/v1/curriculum/lessons/2/madd-asli' });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { id: string };
    expect(body.id).toBe('l2-madd-asli');
    await app.close();
  });

  it('marks a lesson complete and serves it back from progress', async () => {
    const app = await build(baseConfig);
    const post = await app.inject({
      method: 'POST',
      url: '/v1/curriculum/progress',
      payload: { user_id: 'curriculum-test', lesson_id: 'l1-letter-alif' },
    });
    expect(post.statusCode).toBe(201);
    const get = await app.inject({
      method: 'GET',
      url: '/v1/curriculum/progress?user_id=curriculum-test',
    });
    const body = get.json() as { completed: string[] };
    expect(body.completed).toContain('l1-letter-alif');
    await app.close();
  });

  it('rejects unknown lessons with RFC 9457', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({ method: 'GET', url: '/v1/curriculum/lessons/does-not-exist' });
    expect(r.statusCode).toBe(503);
    const body = r.json() as { code: string };
    expect(body.code).toBe('qalaam.data.not-loaded');
    await app.close();
  });
});
