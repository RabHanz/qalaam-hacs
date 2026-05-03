import { describe, expect, it } from 'vitest';

import { QalaamError } from '@qalaam/core';

import { LruCache, QF_TOS_MAX_TTL_MS } from '../src/cache/lru.js';

describe('LruCache', () => {
  it('rejects TTL > QF ToS cap', () => {
    const c = new LruCache<string, number>(10);
    expect(() => c.set('k', 1, QF_TOS_MAX_TTL_MS + 1)).toThrowError(QalaamError);
  });

  it('serves under-TTL values, evicts past TTL', async () => {
    const c = new LruCache<string, number>(10);
    c.set('k', 42, 50);
    expect(c.get('k')).toBe(42);
    await new Promise((r) => setTimeout(r, 80));
    expect(c.get('k')).toBeUndefined();
  });

  it('evicts LRU when at capacity', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1, 5_000);
    c.set('b', 2, 5_000);
    c.set('c', 3, 5_000);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });

  it('rejects invalid maxEntries', () => {
    expect(() => new LruCache<string, number>(0)).toThrowError(QalaamError);
    expect(() => new LruCache<string, number>(-1)).toThrowError(QalaamError);
  });

  it('rejects invalid TTL values', () => {
    const c = new LruCache<string, number>(10);
    expect(() => c.set('k', 1, 0)).toThrowError(QalaamError);
    expect(() => c.set('k', 1, -1)).toThrowError(QalaamError);
    expect(() => c.set('k', 1, Number.NaN)).toThrowError(QalaamError);
  });
});
