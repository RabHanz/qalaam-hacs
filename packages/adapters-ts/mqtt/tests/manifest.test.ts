import { describe, expect, it } from 'vitest';

import { createMqttAdapter } from '../src/index.js';

describe('@qalaam/adapter-mqtt — manifest', () => {
  it('declares the documented capability set', () => {
    const a = createMqttAdapter({ brokerUrl: 'mqtt://localhost:1883' });
    expect(a.id).toBe('mqtt');
    for (const cap of ['play_url', 'pause', 'resume', 'seek', 'volume', 'announce']) {
      expect(a.supportedCapabilities.has(cap as never)).toBe(true);
    }
  });
});
