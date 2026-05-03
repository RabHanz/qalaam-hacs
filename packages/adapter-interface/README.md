# `@qalaam/adapter-interface`

The protocol-agnostic device contract per ADR-0003. Every adapter — Web/PWA, HA, Cast, AirPlay, Sonos, MQTT, Bluetooth — implements `Adapter<TConfig>` and produces `Speaker` objects that conform to a shared shape.

## Design

The standalone Qalaam SaaS, the HA integration, and the self-host install all consume the same `Speaker` / `Adapter` types. The HA integration is **one** of the adapters, not the special root.

### Capability negotiation

Adapters declare their capabilities (e.g., `play_url`, `pause`, `seek`, `volume`, `group`, `announce`). The dispatcher checks `Capability` membership before issuing a command — calling `seek()` on a Bluetooth A2DP speaker that doesn't support it is a typed compile-time error if you import the right helper, or a `QalaamError("qalaam.adapter.capability-unsupported")` at runtime.

### The contract test

Every adapter implementation imports `runAdapterContractTests(adapter)` from `@qalaam/adapter-interface/contract-tests` and runs it as part of its own test suite. This enforces that every adapter respects the same observable behavior.

## Use

```ts
import type { Adapter, Speaker, PlayCommand } from '@qalaam/adapter-interface';
import { CapabilityError, requireCapability } from '@qalaam/adapter-interface';

class MyCustomAdapter implements Adapter {
  // ...
}
```
