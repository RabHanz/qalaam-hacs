/**
 * Tiny size-bounded LRU with strict TTL ceiling per ToS.
 *
 * Per QF Developer ToS: content cache MUST NOT exceed 1 week. We enforce that
 * here, throwing if a caller passes a longer TTL — fail-loud is the right shape.
 */
import { QalaamError } from '@qalaam/core';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface Entry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

export class LruCache<K, V> {
  private readonly maxEntries: number;
  private readonly map = new Map<K, Entry<V>>();

  public constructor(maxEntries: number) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `LruCache: maxEntries must be a positive integer; got ${String(maxEntries)}`,
      );
    }
    this.maxEntries = maxEntries;
  }

  public get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert to bump recency.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  public set(key: K, value: V, ttlMs: number): void {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `LruCache.set: ttlMs must be > 0; got ${String(ttlMs)}`,
      );
    }
    if (ttlMs > ONE_WEEK_MS) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `LruCache.set: ttlMs ${ttlMs.toString()} exceeds the 7-day Quran.Foundation ToS cap.`,
        { outcomeImpacted: 'O-11' },
      );
    }
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as K | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  public clear(): void {
    this.map.clear();
  }

  public get size(): number {
    return this.map.size;
  }
}

export const QF_TOS_MAX_TTL_MS = ONE_WEEK_MS;
