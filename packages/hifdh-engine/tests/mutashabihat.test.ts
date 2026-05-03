import { describe, expect, it } from 'vitest';

import { parseVerseKey } from '@qalaam/core';

import { ingestSwap, siblingsOf } from '../src/mutashabihat/index.js';

const k = parseVerseKey;

describe('mutashabihat confusion graph', () => {
  it('records a swap and surfaces both directions', () => {
    let g = { edges: [] };
    g = ingestSwap(g, k('2:1'), k('3:2'), new Date('2026-05-01T00:00:00Z'));
    expect(siblingsOf(g, k('2:1'))).toEqual([k('3:2')]);
    expect(siblingsOf(g, k('3:2'))).toEqual([k('2:1')]);
  });

  it('increments count on repeated swap', () => {
    let g = { edges: [] };
    g = ingestSwap(g, k('2:1'), k('3:2'), new Date('2026-05-01T00:00:00Z'));
    g = ingestSwap(g, k('2:1'), k('3:2'), new Date('2026-05-02T00:00:00Z'));
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]?.count).toBe(2);
  });

  it('respects minCount filter', () => {
    let g = { edges: [] };
    g = ingestSwap(g, k('2:1'), k('3:2'), new Date('2026-05-01T00:00:00Z'));
    expect(siblingsOf(g, k('2:1'), { minCount: 2 })).toEqual([]);
    g = ingestSwap(g, k('2:1'), k('3:2'), new Date('2026-05-02T00:00:00Z'));
    expect(siblingsOf(g, k('2:1'), { minCount: 2 })).toEqual([k('3:2')]);
  });
});
