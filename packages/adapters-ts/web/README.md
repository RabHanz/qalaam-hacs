# `@qalaam/adapter-web`

Browser-as-speaker adapter — turns the user's current browser tab into a Qalaam Speaker via HTML5 audio + Media Session API.

Per ADR-0003: this adapter ships in v0.1 and is likely the **most-used adapter in practice** (every web user has it; no setup required). It's also the universal fallback when no real smart-home device is available.

## Capabilities

| Capability | Supported |
|---|---|
| play_url | ✓ |
| pause / resume | ✓ |
| seek | ✓ |
| volume | ✓ |
| announce | ✓ (browser tab can play duck-and-restore announcements) |
| group | ✗ |
| queue | ✓ (in-memory) |

## Lock-screen integration

When `navigator.mediaSession` is available (iOS Safari 16.4+, all Android, all desktop browsers), Qalaam sets metadata + action handlers so users can pause/skip/seek from their lockscreen and headphones.

## Use

```ts
import { createWebAdapter } from '@qalaam/adapter-web';
import { AdapterRegistry } from '@qalaam/adapter-interface';

const registry = new AdapterRegistry();
registry.register(createWebAdapter({ name: 'This browser', room: 'desk' }));
```
