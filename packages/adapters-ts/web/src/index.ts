/**
 * `@qalaam/adapter-web` — browser-as-speaker.
 *
 * The adapter exposes ONE speaker per tab (the tab itself). Discovery yields it
 * once and then completes; state changes are pushed via the audio element's
 * native events.
 */
import {
  type Adapter,
  type Capability,
  type PlayOpts,
  type Speaker,
  type SpeakerId,
  type SpeakerState,
} from '@qalaam/adapter-interface';
import { QalaamError } from '@qalaam/core';

const ADAPTER_ID = 'web' as const;
const SUPPORTED: ReadonlySet<Capability> = new Set([
  'play_url',
  'pause',
  'resume',
  'seek',
  'volume',
  'announce',
  'duck',
]);

interface WebAdapterOptions {
  readonly name?: string;
  readonly room?: string;
  /**
   * Override audio element factory — useful for tests. In production we use the
   * window's <audio> element.
   */
  readonly audioElementFactory?: () => HTMLAudioElement;
}

interface InternalState {
  readonly id: SpeakerId;
  audio: HTMLAudioElement | undefined;
  state: SpeakerState;
  /** Saved state for announce-and-restore. */
  saved: { url: string | null; positionMs: number } | undefined;
  listeners: Set<(s: SpeakerState) => void>;
}

export function createWebAdapter(opts: WebAdapterOptions = {}): Adapter {
  const internal: InternalState = {
    id: 'urn:qalaam:speaker:web:tab' as SpeakerId,
    audio: undefined,
    state: { status: 'idle' },
    saved: undefined,
    listeners: new Set(),
  };

  function ensureAudio(): HTMLAudioElement {
    if (internal.audio) return internal.audio;
    if (typeof window === 'undefined') {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        'Web adapter requires a browser environment.',
      );
    }
    const audio =
      opts.audioElementFactory?.() ?? (window.document.createElement('audio') as HTMLAudioElement);
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.addEventListener('play', () => updateState({ status: 'playing' }));
    audio.addEventListener('pause', () => updateState({ status: 'paused' }));
    audio.addEventListener('ended', () => updateState({ status: 'idle' }));
    audio.addEventListener('waiting', () => updateState({ status: 'buffering' }));
    audio.addEventListener('volumechange', () =>
      updateState({ volume: audio.volume, isMuted: audio.muted }),
    );
    audio.addEventListener('timeupdate', () =>
      updateState({ positionMs: Math.floor(audio.currentTime * 1000) }),
    );
    internal.audio = audio;
    return audio;
  }

  function updateState(patch: Partial<SpeakerState>): void {
    internal.state = { ...internal.state, ...patch };
    for (const listener of internal.listeners) listener(internal.state);
  }

  function buildSpeaker(): Speaker {
    return {
      id: internal.id,
      adapter: ADAPTER_ID,
      externalId: 'tab',
      name: opts.name ?? 'This browser',
      ...(opts.room !== undefined ? { room: opts.room } : {}),
      capabilities: SUPPORTED,
      state: internal.state,
      lastSeenAt: new Date().toISOString(),
    };
  }

  function applyMediaSessionMetadata(playOpts?: PlayOpts): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    if (!session) return;
    if (playOpts?.mediaTitle) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      session.metadata = new (globalThis as unknown as { MediaMetadata: typeof MediaMetadata }).MediaMetadata({
        title: playOpts.mediaTitle,
        artist: playOpts.mediaArtist ?? 'Qalaam',
        album: playOpts.verseKey ? `Verse ${playOpts.verseKey}` : undefined,
      });
    }
    session.setActionHandler('play', () => void resume());
    session.setActionHandler('pause', () => void pause());
    session.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) void seek(details.seekTime * 1000);
    });
  }

  async function playUrl(_id: SpeakerId, url: string, playOpts?: PlayOpts): Promise<void> {
    const audio = ensureAudio();
    audio.src = url;
    audio.currentTime = 0;
    applyMediaSessionMetadata(playOpts);
    await audio.play();
  }

  async function pause(): Promise<void> {
    ensureAudio().pause();
  }

  async function resume(): Promise<void> {
    await ensureAudio().play();
  }

  async function seek(_id: SpeakerId | undefined, positionMs?: number): Promise<void> {
    const audio = ensureAudio();
    const target = positionMs ?? 0;
    audio.currentTime = target / 1000;
  }

  async function setVolume(_id: SpeakerId, level: number): Promise<void> {
    const audio = ensureAudio();
    const clamped = Math.max(0, Math.min(1, level));
    audio.volume = clamped;
  }

  async function announce(id: SpeakerId, url: string, options?: { duck?: boolean }): Promise<void> {
    // Save current state, play, then restore. Per strategy §10.1 broadcast-group.
    const audio = ensureAudio();
    internal.saved = {
      url: audio.src || null,
      positionMs: Math.floor(audio.currentTime * 1000),
    };
    if (options?.duck) audio.volume = Math.min(audio.volume, 0.7);
    await playUrl(id, url);
    audio.addEventListener(
      'ended',
      () => {
        if (internal.saved?.url) {
          audio.src = internal.saved.url;
          audio.currentTime = internal.saved.positionMs / 1000;
        }
        internal.saved = undefined;
      },
      { once: true },
    );
  }

  return {
    id: ADAPTER_ID,
    displayName: 'Web (this browser)',
    supportedCapabilities: SUPPORTED,
    async *discover() {
      yield buildSpeaker();
    },
    async getState(): Promise<SpeakerState> {
      return internal.state;
    },
    playUrl,
    pause: async (_id) => pause(),
    resume: async (_id) => resume(),
    seek: async (id, ms) => seek(id, ms),
    setVolume: (id, level) => setVolume(id, level),
    announce: (id, url, o) => announce(id, url, o),
    subscribe(_id, callback) {
      internal.listeners.add(callback);
      return () => internal.listeners.delete(callback);
    },
  };
}
