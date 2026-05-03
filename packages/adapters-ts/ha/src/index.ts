/**
 * `@qalaam/adapter-ha` — speak HA's WebSocket API from outside HA.
 *
 * Discovery enumerates every entity with domain `media_player` and exposes each
 * as a Qalaam Speaker. Commands map to `media_player.play_media`, `pause`, etc.
 *
 * Per ADR-0003: this is the highest-leverage adapter. We inherit HA's entire
 * device coverage without further per-protocol work.
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
import {
  type Connection,
  type HassEntity,
  callService,
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
} from 'home-assistant-js-websocket';

const ADAPTER_ID = 'ha' as const;

// HA media_player supported_features bitmask — abridged to what Qalaam uses.
const HA_FEATURE = {
  PAUSE: 1,
  SEEK: 2,
  VOLUME_SET: 4,
  VOLUME_MUTE: 8,
  PREVIOUS_TRACK: 16,
  NEXT_TRACK: 32,
  TURN_ON: 128,
  TURN_OFF: 256,
  PLAY_MEDIA: 512,
  STOP: 4096,
  PLAY: 16384,
  GROUPING: 524288,
} as const;

interface HomeAssistantAdapterOptions {
  readonly baseUrl: string;
  readonly accessToken: string;
}

function entityToSpeaker(entity: HassEntity): Speaker {
  const supported = (entity.attributes['supported_features'] as number | undefined) ?? 0;
  const caps: Capability[] = ['play_url'];
  if (supported & HA_FEATURE.PAUSE) caps.push('pause');
  if (supported & HA_FEATURE.PLAY) caps.push('resume');
  if (supported & HA_FEATURE.SEEK) caps.push('seek');
  if (supported & HA_FEATURE.VOLUME_SET) caps.push('volume');
  if (supported & HA_FEATURE.GROUPING) caps.push('group');
  return {
    id: `urn:qalaam:speaker:ha:${entity.entity_id}` as SpeakerId,
    adapter: ADAPTER_ID,
    externalId: entity.entity_id,
    name: (entity.attributes['friendly_name'] as string | undefined) ?? entity.entity_id,
    capabilities: new Set(caps),
    state: mapState(entity),
    lastSeenAt: new Date().toISOString(),
  };
}

function mapState(entity: HassEntity): SpeakerState {
  const status = mapStatus(entity.state);
  const volume = entity.attributes['volume_level'] as number | undefined;
  const isMuted = entity.attributes['is_volume_muted'] as boolean | undefined;
  const positionMs = entity.attributes['media_position'] !== undefined
    ? Math.floor(Number(entity.attributes['media_position']) * 1000)
    : undefined;
  return {
    status,
    ...(positionMs !== undefined ? { positionMs } : {}),
    ...(volume !== undefined ? { volume } : {}),
    ...(isMuted !== undefined ? { isMuted } : {}),
    mediaId:
      (entity.attributes['media_content_id'] as string | undefined) ?? null,
  };
}

function mapStatus(haState: string): SpeakerState['status'] {
  switch (haState) {
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'idle':
      return 'idle';
    case 'buffering':
      return 'buffering';
    case 'off':
      return 'off';
    case 'on':
      return 'idle';
    default:
      return 'unavailable';
  }
}

function externalId(speakerId: SpeakerId): string {
  // urn:qalaam:speaker:ha:media_player.living_room → media_player.living_room
  const parts = speakerId.split(':');
  return parts.slice(4).join(':');
}

export function createHomeAssistantAdapter(opts: HomeAssistantAdapterOptions): Adapter {
  let connection: Connection | undefined;
  const speakers = new Map<SpeakerId, Speaker>();
  const listeners = new Map<SpeakerId, Set<(s: SpeakerState) => void>>();

  async function ensureConnection(): Promise<Connection> {
    if (connection) return connection;
    const auth = createLongLivedTokenAuth(opts.baseUrl, opts.accessToken);
    connection = await createConnection({ auth });
    subscribeEntities(connection, (entities) => {
      for (const entity of Object.values(entities)) {
        if (!entity.entity_id.startsWith('media_player.')) continue;
        const speaker = entityToSpeaker(entity);
        speakers.set(speaker.id, speaker);
        for (const listener of listeners.get(speaker.id) ?? []) listener(speaker.state);
      }
    });
    return connection;
  }

  async function call(domain: string, service: string, target: string, data: Record<string, unknown> = {}): Promise<void> {
    const conn = await ensureConnection();
    await callService(conn, domain, service, data, { entity_id: target });
  }

  return {
    id: ADAPTER_ID,
    displayName: 'Home Assistant',
    supportedCapabilities: new Set<Capability>([
      'play_url',
      'pause',
      'resume',
      'seek',
      'volume',
      'group',
      'announce',
    ]),
    async *discover(signal) {
      await ensureConnection();
      // Wait briefly for the first state burst to populate `speakers`.
      await new Promise((r) => setTimeout(r, 50));
      for (const speaker of speakers.values()) {
        if (signal.aborted) return;
        yield speaker;
      }
    },
    async getState(id) {
      const speaker = speakers.get(id);
      if (!speaker) {
        throw new QalaamError('qalaam.data.not-loaded', `HA speaker ${id} not yet discovered.`);
      }
      return speaker.state;
    },
    async playUrl(id, url, playOpts?: PlayOpts) {
      await call('media_player', 'play_media', externalId(id), {
        media_content_id: url,
        media_content_type: 'music',
        ...(playOpts?.announce ? { announce: true } : {}),
        ...(playOpts?.enqueue && playOpts.enqueue !== 'replace'
          ? { enqueue: playOpts.enqueue }
          : {}),
      });
    },
    async pause(id) {
      await call('media_player', 'media_pause', externalId(id));
    },
    async resume(id) {
      await call('media_player', 'media_play', externalId(id));
    },
    async seek(id, positionMs) {
      await call('media_player', 'media_seek', externalId(id), {
        seek_position: positionMs / 1000,
      });
    },
    async setVolume(id, level) {
      await call('media_player', 'volume_set', externalId(id), {
        volume_level: Math.max(0, Math.min(1, level)),
      });
    },
    async announce(id, url, options) {
      await call('media_player', 'play_media', externalId(id), {
        media_content_id: url,
        media_content_type: 'music',
        announce: true,
        ...(options?.duck ? { extra: { volume_offset: -0.3 } } : {}),
      });
    },
    subscribe(id, callback) {
      const set = listeners.get(id) ?? new Set();
      set.add(callback);
      listeners.set(id, set);
      return () => set.delete(callback);
    },
  };
}
