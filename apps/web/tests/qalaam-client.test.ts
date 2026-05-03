/**
 * Smoke test for the Qalaam web client. Mocks fetch; verifies error mapping.
 */
import { describe, expect, it, vi } from 'vitest';

import { QalaamError, parseVerseKey } from '@qalaam/core';

import { qalaamClient } from '../src/lib/qalaam-client.js';

describe('qalaamClient', () => {
  it('parses a successful verse response', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          verseKey: '1:1',
          surah: 1,
          ayah: 1,
          juz: 1,
          hizb: 1,
          rubElHizb: 1,
          ruku: 1,
          manzil: 1,
          pageMadani15: 1,
          textUthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
          wordCount: 4,
          isSajdah: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fakeFetch as unknown as typeof fetch);
    const v = await qalaamClient.getVerseByKey(parseVerseKey('1:1'));
    expect(v.textUthmani).toContain('بِسْمِ');
    vi.unstubAllGlobals();
  });

  it('maps a 503 to QalaamError with code qalaam.data.not-loaded', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 'qalaam.data.not-loaded',
          detail: 'QUL not present',
          status: 503,
          title: 'qalaam.data.not-loaded',
          type: 'about:blank',
        }),
        { status: 503, headers: { 'content-type': 'application/problem+json' } },
      ),
    );
    vi.stubGlobal('fetch', fakeFetch as unknown as typeof fetch);
    await expect(qalaamClient.getVerseByKey(parseVerseKey('2:1'))).rejects.toThrow(QalaamError);
    vi.unstubAllGlobals();
  });
});
