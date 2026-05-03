import { describe, expect, it, vi } from 'vitest';

import { createWebAdapter } from '../src/index.js';

class FakeAudio extends EventTarget {
  src = '';
  currentTime = 0;
  volume = 1;
  muted = false;
  preload = '';
  crossOrigin: string | null = null;
  paused = true;
  play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  });
  addEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions): void => {
    super.addEventListener(type, listener, options);
  };
}

describe('@qalaam/adapter-web', () => {
  it('discovers the browser tab as a single speaker', async () => {
    const adapter = createWebAdapter({
      audioElementFactory: () => new FakeAudio() as unknown as HTMLAudioElement,
      name: 'Test',
    });
    const seen: unknown[] = [];
    for await (const s of adapter.discover(new AbortController().signal)) seen.push(s);
    expect(seen).toHaveLength(1);
  });

  it('plays a URL and transitions to playing', async () => {
    const fake = new FakeAudio() as unknown as HTMLAudioElement;
    const adapter = createWebAdapter({ audioElementFactory: () => fake });
    const speakers: { id: string }[] = [];
    for await (const s of adapter.discover(new AbortController().signal)) speakers.push({ id: s.id });
    await adapter.playUrl(speakers[0]!.id as never, 'https://example.test/x.mp3');
    expect((fake as unknown as FakeAudio).play).toHaveBeenCalled();
    expect((fake as unknown as FakeAudio).src).toBe('https://example.test/x.mp3');
  });

  it('clamps volume to [0, 1]', async () => {
    const fake = new FakeAudio() as unknown as HTMLAudioElement;
    const adapter = createWebAdapter({ audioElementFactory: () => fake });
    const speakers: { id: string }[] = [];
    for await (const s of adapter.discover(new AbortController().signal)) speakers.push({ id: s.id });
    await adapter.setVolume(speakers[0]!.id as never, 5);
    expect((fake as unknown as FakeAudio).volume).toBe(1);
    await adapter.setVolume(speakers[0]!.id as never, -1);
    expect((fake as unknown as FakeAudio).volume).toBe(0);
  });
});
