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

describe('Translation routes', () => {
  it('lists 3 bundled translations', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({ method: 'GET', url: '/v1/translations' });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { translations: { slug: string }[] };
    expect(body.translations.length).toBeGreaterThanOrEqual(3);
    const slugs = body.translations.map((t) => t.slug);
    expect(slugs).toContain('pickthall');
    expect(slugs).toContain('saheeh-international');
    expect(slugs).toContain('clear-quran');
    await app.close();
  });

  it('serves Pickthall Al-Fatiha 1', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({ method: 'GET', url: '/v1/translations/pickthall/by_verse/1:1' });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { text: string };
    expect(body.text).toMatch(/Beneficent/i);
    await app.close();
  });

  it('serves Saheeh Al-Fatiha 5', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({
      method: 'GET',
      url: '/v1/translations/saheeh-international/by_verse/1:5',
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { text: string };
    expect(body.text).toMatch(/worship/i);
    await app.close();
  });

  it('returns 503 with RFC 9457 for unbundled verse', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({ method: 'GET', url: '/v1/translations/pickthall/by_verse/2:1' });
    expect(r.statusCode).toBe(503);
    const body = r.json() as { code: string };
    expect(body.code).toBe('qalaam.data.not-loaded');
    await app.close();
  });
});

describe('Tafsir routes', () => {
  it('lists 2 bundled tafsirs', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({ method: 'GET', url: '/v1/tafsirs' });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { tafsirs: { slug: string }[] };
    expect(body.tafsirs.map((t) => t.slug)).toEqual(
      expect.arrayContaining(['muyassar', 'saheeh-footnotes']),
    );
    await app.close();
  });

  it('serves Muyassar Al-Fatiha 1', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({ method: 'GET', url: '/v1/tafsirs/muyassar/by_verse/1:1' });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { text: string };
    expect(body.text).toMatch(/الفاتحة/);
    await app.close();
  });

  it('serves Saheeh footnote for Al-Fatiha 1', async () => {
    const app = await build(baseConfig);
    const r = await app.inject({
      method: 'GET',
      url: '/v1/tafsirs/saheeh-footnotes/by_verse/1:1',
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { text: string };
    expect(body.text).toMatch(/Opening|Umm/i);
    await app.close();
  });
});
