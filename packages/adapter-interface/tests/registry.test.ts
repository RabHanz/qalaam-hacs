import { describe, expect, it, vi } from 'vitest';

import { AdapterRegistry } from '../src/registry.js';
import type { Adapter, AdapterId, Speaker, SpeakerId } from '../src/types.js';

function makeFakeAdapter(id: AdapterId, speakers: Speaker[]): Adapter {
  return {
    id,
    displayName: `Fake ${id}`,
    supportedCapabilities: new Set(['play_url', 'pause', 'resume']),
    async *discover() {
      for (const s of speakers) yield s;
    },
    async getState() {
      return { status: 'idle' };
    },
    playUrl: vi.fn(async () => Promise.resolve()),
    pause: vi.fn(async () => Promise.resolve()),
    resume: vi.fn(async () => Promise.resolve()),
    seek: vi.fn(async () => Promise.resolve()),
    setVolume: vi.fn(async () => Promise.resolve()),
  };
}

function fakeSpeaker(adapter: AdapterId, id: string): Speaker {
  return {
    id: `urn:fake:${id}` as SpeakerId,
    adapter,
    externalId: id,
    name: `${id} speaker`,
    capabilities: new Set(['play_url', 'pause', 'resume']),
    state: { status: 'idle' },
    lastSeenAt: new Date().toISOString(),
  };
}

describe('AdapterRegistry', () => {
  it('registers and dispatches', async () => {
    const registry = new AdapterRegistry();
    const speaker = fakeSpeaker('cast', 'living-room');
    const adapter = makeFakeAdapter('cast', [speaker]);
    registry.register(adapter);

    await registry.discoverAll(new AbortController().signal);
    expect(registry.listSpeakers()).toHaveLength(1);

    await registry.playUrl(speaker.id, 'https://example.test/audio.mp3', {
      verseKey: '1:1',
      reciterSlug: 'mishary-alafasy',
    });
    expect(adapter.playUrl).toHaveBeenCalledOnce();
  });

  it('rejects duplicate adapter registration', () => {
    const registry = new AdapterRegistry();
    registry.register(makeFakeAdapter('cast', []));
    expect(() => registry.register(makeFakeAdapter('cast', []))).toThrow();
  });

  it('throws for unknown speaker', async () => {
    const registry = new AdapterRegistry();
    await expect(registry.pause('urn:fake:nope' as SpeakerId)).rejects.toThrow();
  });

  it('broadcast dispatches to every speaker, returning ok / failed split', async () => {
    const registry = new AdapterRegistry();
    const a = fakeSpeaker('cast', 'a');
    const b = fakeSpeaker('cast', 'b');
    const adapter = makeFakeAdapter('cast', [a, b]);
    // Make 'b' fail
    adapter.playUrl = vi.fn(async (id) => {
      if (id === b.id) throw new Error('boom');
      return Promise.resolve();
    });
    registry.register(adapter);
    await registry.discoverAll(new AbortController().signal);

    const result = await registry.broadcast([a.id, b.id], 'https://example.test/adhan.mp3', {
      announce: true,
      duck: true,
    });
    expect(result.ok).toEqual([a.id]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.id).toBe(b.id);
  });
});
