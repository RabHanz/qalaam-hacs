import { describe, expect, it } from 'vitest';

import { createHomeAssistantAdapter } from '../src/index.js';

describe('@qalaam/adapter-ha — manifest', () => {
  it('declares id, displayName, and the right capability set', () => {
    const adapter = createHomeAssistantAdapter({
      baseUrl: 'http://localhost:8123',
      accessToken: 'test-token',
    });
    expect(adapter.id).toBe('ha');
    expect(adapter.displayName).toBe('Home Assistant');
    for (const cap of ['play_url', 'pause', 'resume', 'seek', 'volume', 'group', 'announce']) {
      expect(adapter.supportedCapabilities.has(cap as never)).toBe(true);
    }
  });
});
