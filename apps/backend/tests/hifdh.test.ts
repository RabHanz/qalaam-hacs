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

describe('Hifdh routes', () => {
  it('full create→session→rate cycle', async () => {
    const app = await build(baseConfig);

    // 1) Create a portion (Al-Fatiha 1:1 — 1:7).
    const create = await app.inject({
      method: 'POST',
      url: '/v1/hifdh/portion',
      payload: {
        user_id: 't-user',
        start_verse_key: '1:1',
        end_verse_key: '1:7',
        status: 'new',
      },
    });
    expect(create.statusCode).toBe(201);
    const portion = create.json() as { id: string; status: string };
    expect(portion.status).toBe('new');

    // 2) Today's session should include it.
    const session = await app.inject({
      method: 'GET',
      url: '/v1/hifdh/session?user_id=t-user',
    });
    expect(session.statusCode).toBe(200);
    const sessionBody = session.json() as { items: { portionId: string; bucket: string }[] };
    expect(sessionBody.items.find((i) => i.portionId === portion.id)).toBeDefined();

    // 3) Rate it (fluent × clean = grade 4 = Easy).
    const rate = await app.inject({
      method: 'POST',
      url: '/v1/hifdh/rate',
      payload: {
        user_id: 't-user',
        portion_id: portion.id,
        fluency: 3,
        accuracy: 3,
      },
    });
    expect(rate.statusCode).toBe(200);
    const rateBody = rate.json() as { derived_grade: number };
    expect(rateBody.derived_grade).toBe(4);

    await app.close();
  });

  it('rate returns RFC 9457 problem-detail for unknown portion', async () => {
    const app = await build(baseConfig);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/hifdh/rate',
      payload: {
        user_id: 't-user-2',
        portion_id: '00000000-0000-4000-8000-deadbeef0001',
        fluency: 3,
        accuracy: 3,
      },
    });
    expect(res.statusCode).toBe(503);
    expect(res.headers['content-type']).toContain('application/problem+json');
    await app.close();
  });
});

describe('Recitation routes', () => {
  it('lists seeded reciters', async () => {
    const app = await build(baseConfig);
    const res = await app.inject({ method: 'GET', url: '/v1/recitations' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as { reciters: { slug: string }[] };
    expect(json.reciters.length).toBeGreaterThanOrEqual(3);
    expect(json.reciters.find((r) => r.slug === 'mishary-alafasy')).toBeDefined();
    await app.close();
  });

  it('resolves Al-Fatiha 1:1 audio URL for Mishary', async () => {
    const app = await build(baseConfig);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/audio/by_verse/1:1/mishary-alafasy',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { audioUrl: string; reciterSlug: string };
    expect(body.audioUrl).toMatch(/everyayah\.com\/data\/Alafasy_128kbps\/001001\.mp3/);
    expect(body.reciterSlug).toBe('mishary-alafasy');
    await app.close();
  });

  it('rejects unknown reciter with RFC 9457', async () => {
    const app = await build(baseConfig);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/audio/by_verse/1:1/nope',
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
