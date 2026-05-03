/**
 * Speaker / Adapter contract — the universal interface every protocol implements.
 * Per ADR-0003.
 */
import { QalaamError } from '@qalaam/core';

/** Adapter identifier. Must match the enum in `schemas/device/Speaker.schema.json`. */
export type AdapterId =
  | 'web'
  | 'ha'
  | 'cast'
  | 'airplay'
  | 'sonos'
  | 'mqtt'
  | 'bluetooth'
  | 'dlna'
  | 'snapcast';

/** Capabilities a speaker can offer. Must match `device/Speaker.schema.json`. */
export type Capability =
  | 'play_url'
  | 'pause'
  | 'resume'
  | 'seek'
  | 'volume'
  | 'queue'
  | 'group'
  | 'announce'
  | 'duck';

declare const speakerIdBrand: unique symbol;
export type SpeakerId = string & { readonly [speakerIdBrand]: 'SpeakerId' };

export interface SpeakerState {
  readonly status: 'idle' | 'playing' | 'paused' | 'buffering' | 'off' | 'unavailable';
  readonly positionMs?: number;
  readonly mediaId?: string | null;
  readonly volume?: number; // 0..1
  readonly isMuted?: boolean;
  readonly groupMembers?: readonly SpeakerId[];
}

export interface Speaker {
  readonly id: SpeakerId;
  readonly adapter: AdapterId;
  readonly externalId: string;
  readonly name: string;
  readonly room?: string;
  readonly capabilities: ReadonlySet<Capability>;
  readonly state: SpeakerState;
  readonly lastSeenAt: string;
}

export interface PlayOpts {
  readonly mediaTitle?: string;
  readonly mediaArtist?: string;
  /** Quranic context — drives word-by-word highlighting on UI clients. */
  readonly verseKey?: string;
  readonly reciterSlug?: string;
  readonly announce?: boolean;
  readonly duck?: boolean;
  readonly enqueue?: 'replace' | 'next' | 'add' | 'play';
}

/**
 * The contract every adapter implements. Methods MAY throw QalaamError with code
 * `qalaam.adapter.capability-unsupported` if the speaker doesn't have the required capability.
 */
export interface Adapter {
  readonly id: AdapterId;
  readonly displayName: string;
  /** Capabilities the adapter as a whole can support; per-speaker capabilities may be a subset. */
  readonly supportedCapabilities: ReadonlySet<Capability>;

  /** Yield speakers as they're discovered. May be a long-running stream. */
  discover(signal: AbortSignal): AsyncIterable<Speaker>;

  /** Refresh state for a single speaker. */
  getState(id: SpeakerId): Promise<SpeakerState>;

  /** Begin playback of a URL on the named speaker. */
  playUrl(id: SpeakerId, url: string, opts?: PlayOpts): Promise<void>;

  pause(id: SpeakerId): Promise<void>;
  resume(id: SpeakerId): Promise<void>;
  seek(id: SpeakerId, positionMs: number): Promise<void>;
  setVolume(id: SpeakerId, level: number): Promise<void>;

  /** Optional: play a duck-and-restore announcement (e.g., adhan or sabaq prompt). */
  announce?(id: SpeakerId, url: string, opts?: { duck?: boolean }): Promise<void>;

  /** Optional: form an ad-hoc multi-room group. */
  group?(ids: readonly SpeakerId[]): Promise<{ groupId: SpeakerId }>;

  /** Optional: subscribe to push state changes (most adapters support, web/MQTT not always). */
  subscribe?(id: SpeakerId, callback: (s: SpeakerState) => void): () => void;
}
