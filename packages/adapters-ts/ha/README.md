# `@qalaam/adapter-ha`

Home Assistant as a Qalaam adapter. Per ADR-0003.

The killer leverage: by speaking HA's WebSocket API from outside HA, we **inherit its entire `media_player` matrix** — Sonos, Cast, AirPlay, Squeezebox, LMS, Bluesound, Heos, Yamaha MusicCast, every DLNA renderer HA can drive — without writing one more adapter.

## Auth

Long-lived access token created in HA → stored as Qalaam config. The Qalaam backend (or self-host install) connects once and keeps the WS open.

## Capabilities exposed

Every HA `media_player` entity becomes a Qalaam `Speaker`. Capability set is derived from each entity's `supported_features` bitmask.

## Use

```ts
import { createHomeAssistantAdapter } from '@qalaam/adapter-ha';
import { AdapterRegistry } from '@qalaam/adapter-interface';

const ha = createHomeAssistantAdapter({
  baseUrl: 'http://homeassistant.local:8123',
  accessToken: process.env.HA_LONG_LIVED_TOKEN!,
});
const registry = new AdapterRegistry();
registry.register(ha);
```
