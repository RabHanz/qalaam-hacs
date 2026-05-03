/**
 * Adapter registry — the dispatcher that turns "play this verse on this speaker"
 * into the right adapter call. Per ADR-0003.
 *
 * The registry holds N adapters and exposes a unified `getSpeaker` / `playUrl` API.
 * The standalone backend, the HA integration, and the self-host install all use
 * the same registry — only the set of registered adapters differs.
 */
import { QalaamError } from '@qalaam/core';

import { type Adapter, type AdapterId, type PlayOpts, type Speaker, type SpeakerId, type SpeakerState } from './types.js';

export class AdapterRegistry {
  private readonly adapters = new Map<AdapterId, Adapter>();
  private readonly speakers = new Map<SpeakerId, Speaker>();

  public register(adapter: Adapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `AdapterRegistry: adapter "${adapter.id}" already registered.`,
      );
    }
    this.adapters.set(adapter.id, adapter);
  }

  public has(adapterId: AdapterId): boolean {
    return this.adapters.has(adapterId);
  }

  /** Iterate registered adapter ids, in registration order. */
  public adapterIds(): readonly AdapterId[] {
    return [...this.adapters.keys()];
  }

  /** Begin background discovery across every registered adapter. */
  public async discoverAll(signal: AbortSignal): Promise<void> {
    await Promise.all(
      [...this.adapters.values()].map(async (adapter) => {
        for await (const speaker of adapter.discover(signal)) {
          this.speakers.set(speaker.id, speaker);
        }
      }),
    );
  }

  public listSpeakers(): readonly Speaker[] {
    return [...this.speakers.values()];
  }

  public getSpeaker(id: SpeakerId): Speaker {
    const s = this.speakers.get(id);
    if (!s) {
      throw new QalaamError('qalaam.data.not-loaded', `No speaker known with id ${id}`);
    }
    return s;
  }

  public async playUrl(id: SpeakerId, url: string, opts?: PlayOpts): Promise<void> {
    const speaker = this.getSpeaker(id);
    const adapter = this.requireAdapter(speaker.adapter);
    await adapter.playUrl(id, url, opts);
  }

  public async pause(id: SpeakerId): Promise<void> {
    const speaker = this.getSpeaker(id);
    await this.requireAdapter(speaker.adapter).pause(id);
  }

  public async resume(id: SpeakerId): Promise<void> {
    const speaker = this.getSpeaker(id);
    await this.requireAdapter(speaker.adapter).resume(id);
  }

  public async setVolume(id: SpeakerId, level: number): Promise<void> {
    const speaker = this.getSpeaker(id);
    await this.requireAdapter(speaker.adapter).setVolume(id, level);
  }

  public async getState(id: SpeakerId): Promise<SpeakerState> {
    const speaker = this.getSpeaker(id);
    return this.requireAdapter(speaker.adapter).getState(id);
  }

  /**
   * Broadcast: dispatch the same play command across every speaker in `scope`.
   * Used for adhan-aware announcements (strategy §10.1, §24).
   */
  public async broadcast(
    speakerIds: readonly SpeakerId[],
    url: string,
    opts: PlayOpts & { announce: true; duck?: boolean },
  ): Promise<{ ok: SpeakerId[]; failed: { id: SpeakerId; error: unknown }[] }> {
    const ok: SpeakerId[] = [];
    const failed: { id: SpeakerId; error: unknown }[] = [];
    await Promise.all(
      speakerIds.map(async (id) => {
        try {
          const speaker = this.getSpeaker(id);
          const adapter = this.requireAdapter(speaker.adapter);
          if (adapter.announce) {
            await adapter.announce(id, url, { duck: opts.duck });
          } else {
            await adapter.playUrl(id, url, opts);
          }
          ok.push(id);
        } catch (error) {
          failed.push({ id, error });
        }
      }),
    );
    return { ok, failed };
  }

  private requireAdapter(id: AdapterId): Adapter {
    const a = this.adapters.get(id);
    if (!a) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `Adapter "${id}" is not registered.`,
      );
    }
    return a;
  }
}
