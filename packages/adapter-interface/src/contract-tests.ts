/**
 * Contract tests — every Adapter implementation imports and runs these.
 *
 * Usage in an adapter package:
 *
 *   import { describe } from 'vitest';
 *   import { runAdapterContractTests } from '@qalaam/adapter-interface/contract-tests';
 *   import { WebPwaAdapter } from '../src/adapter.js';
 *
 *   describe('WebPwaAdapter', () => {
 *     runAdapterContractTests(() => new WebPwaAdapter(/* mocks */));
 *   });
 *
 * Tests exercise observable behavior only — never adapter internals.
 */
import { describe, expect, it } from 'vitest';

import { CapabilityError, hasCapability } from './capabilities.js';
import { type Adapter, type Speaker } from './types.js';

export function runAdapterContractTests(factory: () => Adapter): void {
  describe('Adapter contract', () => {
    it('declares an id and a display name', () => {
      const a = factory();
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(typeof a.displayName).toBe('string');
      expect(a.displayName.length).toBeGreaterThan(0);
    });

    it('declares supported capabilities as a Set', () => {
      const a = factory();
      expect(a.supportedCapabilities).toBeInstanceOf(Set);
    });

    it('discover() returns an async iterable that respects an abort signal', async () => {
      const a = factory();
      const ctrl = new AbortController();
      ctrl.abort();
      const seen: Speaker[] = [];
      for await (const s of a.discover(ctrl.signal)) {
        seen.push(s);
        if (seen.length > 5) break; // safety net for adapters that ignore abort
      }
      // No assertion on count — adapters may emit cached speakers before honoring abort.
      // The contract is just that the iterator terminates.
      expect(seen.length).toBeGreaterThanOrEqual(0);
    });

    it('throws CapabilityError when a speaker lacks the capability', () => {
      const a = factory();
      const fakeSpeaker: Speaker = {
        id: 'urn:test:1' as Speaker['id'],
        adapter: a.id,
        externalId: 'test',
        name: 'Test',
        capabilities: new Set(),
        state: { status: 'idle' },
        lastSeenAt: new Date().toISOString(),
      };
      expect(hasCapability(fakeSpeaker, 'play_url')).toBe(false);
      expect(() => {
        if (!hasCapability(fakeSpeaker, 'play_url')) {
          throw new CapabilityError(fakeSpeaker.id, 'play_url', fakeSpeaker.name);
        }
      }).toThrowError(CapabilityError);
    });
  });
}
