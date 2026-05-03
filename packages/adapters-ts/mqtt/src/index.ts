/**
 * `@qalaam/adapter-mqtt` — MQTT topic adapter.
 *
 * Speakers are discovered by listening to retained `qalaam/speaker/+/state`
 * topics. Commands are published; speakers are responsible for honoring them.
 */
import {
  type Adapter,
  type Capability,
  type Speaker,
  type SpeakerId,
  type SpeakerState,
} from '@qalaam/adapter-interface';
import { QalaamError } from '@qalaam/core';
import mqtt, { type MqttClient } from 'mqtt';

const ADAPTER_ID = 'mqtt' as const;
const SUPPORTED: ReadonlySet<Capability> = new Set([
  'play_url',
  'pause',
  'resume',
  'seek',
  'volume',
  'announce',
]);

interface MqttAdapterOptions {
  readonly brokerUrl: string;
  readonly username?: string;
  readonly password?: string;
  readonly topicPrefix?: string;
}

const DEFAULT_PREFIX = 'qalaam/speaker';

function speakerIdFor(externalId: string): SpeakerId {
  return `urn:qalaam:speaker:mqtt:${externalId}` as SpeakerId;
}

function externalIdFor(id: SpeakerId): string {
  return id.split(':').slice(4).join(':');
}

export function createMqttAdapter(opts: MqttAdapterOptions): Adapter {
  const prefix = opts.topicPrefix ?? DEFAULT_PREFIX;
  let client: MqttClient | undefined;
  const speakers = new Map<SpeakerId, Speaker>();
  const listeners = new Map<SpeakerId, Set<(s: SpeakerState) => void>>();

  function ensureClient(): MqttClient {
    if (client) return client;
    client = mqtt.connect(opts.brokerUrl, {
      ...(opts.username !== undefined ? { username: opts.username } : {}),
      ...(opts.password !== undefined ? { password: opts.password } : {}),
      reconnectPeriod: 5000,
    });
    client.on('connect', () => {
      client?.subscribe(`${prefix}/+/state`);
    });
    client.on('message', (topic, payload) => {
      const m = topic.match(new RegExp(`^${escapeRegex(prefix)}/([^/]+)/state$`));
      if (!m) return;
      const externalId = m[1] ?? '';
      const id = speakerIdFor(externalId);
      let parsed: Partial<SpeakerState> = { status: 'idle' };
      try {
        parsed = JSON.parse(payload.toString()) as Partial<SpeakerState>;
      } catch {
        // ignore malformed retained payload
      }
      const existing = speakers.get(id);
      const next: Speaker = existing
        ? { ...existing, state: { status: 'idle', ...parsed }, lastSeenAt: new Date().toISOString() }
        : {
            id,
            adapter: ADAPTER_ID,
            externalId,
            name: externalId,
            capabilities: SUPPORTED,
            state: { status: 'idle', ...parsed },
            lastSeenAt: new Date().toISOString(),
          };
      speakers.set(id, next);
      for (const listener of listeners.get(id) ?? []) listener(next.state);
    });
    return client;
  }

  function publish(id: SpeakerId, suffix: string, payload: Record<string, unknown> = {}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const c = ensureClient();
      c.publish(
        `${prefix}/${externalIdFor(id)}/${suffix}`,
        JSON.stringify(payload),
        { qos: 1 },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  return {
    id: ADAPTER_ID,
    displayName: 'MQTT',
    supportedCapabilities: SUPPORTED,
    async *discover(signal) {
      ensureClient();
      // Yield speakers as state messages arrive. Honor abort.
      let yielded = new Set<SpeakerId>();
      while (!signal.aborted) {
        for (const speaker of speakers.values()) {
          if (yielded.has(speaker.id)) continue;
          yielded.add(speaker.id);
          yield speaker;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    },
    async getState(id) {
      const speaker = speakers.get(id);
      if (!speaker) {
        throw new QalaamError('qalaam.data.not-loaded', `MQTT speaker ${id} not yet discovered.`);
      }
      return speaker.state;
    },
    async playUrl(id, url, opts2) {
      await publish(id, 'play', { url, verseKey: opts2?.verseKey });
    },
    async pause(id) {
      await publish(id, 'pause');
    },
    async resume(id) {
      await publish(id, 'resume');
    },
    async seek(id, positionMs) {
      await publish(id, 'seek', { position_ms: positionMs });
    },
    async setVolume(id, level) {
      await publish(id, 'volume', { level: Math.max(0, Math.min(1, level)) });
    },
    async announce(id, url, options) {
      await publish(id, 'announce', { url, duck: options?.duck ?? false });
    },
    subscribe(id, callback) {
      const set = listeners.get(id) ?? new Set();
      set.add(callback);
      listeners.set(id, set);
      return () => set.delete(callback);
    },
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
