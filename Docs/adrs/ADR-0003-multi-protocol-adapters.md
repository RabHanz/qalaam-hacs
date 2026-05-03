# ADR-0003: Multi-protocol device-adapter pattern (HA is one of many)

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** O-09 (smart-home integration), O-13 (ambient passive playback)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

The user explicitly required Qalaam to "not be Home Assistant specific but workable with all/most home devices/nodes." This rules out an HA-first architecture where HA is the only supported smart-home target.

The 2026 multi-protocol media-control landscape (per §5 of the strategy doc and §20.4 delta):
- **Google Cast** — biggest install base, no pairing, only viable Python lib (`pychromecast`).
- **Sonos** — best API of any vendor; `node-sonos-ts` mature.
- **AirPlay 2** — `pyatv` works with caveats (HAP-auth RAOP not implemented; HomePod sync needs Music Assistant).
- **Web/PWA** — Media Session API gives lockscreen controls; likely the most-used adapter in practice.
- **Home Assistant** — `home-assistant-js-websocket` lets us call any HA `media_player.play_media` from outside HA, inheriting HA's entire device matrix.
- **MQTT** — trivial, ~50 LoC, pairs with ESPHome and Snapcast.
- **Bluetooth A2DP** — Pi-in-the-kid's-room fallback.
- Skip: Matter Casting (still video-first in 2026), HomeKit-as-output (no `play_url`), Alexa Music Skill (Amazon partnership required).

Music Assistant is the closest existing project — we will study its `players/` directory before writing adapters.

## Decision

We will define a single `Speaker` / `Adapter` interface in `packages/adapter-interface` that all protocol implementations satisfy. v1.0 ships seven adapters: **Web/PWA, HA-as-adapter, Sonos, Google Cast (Python sidecar), AirPlay 2 (Python sidecar), MQTT, Bluetooth A2DP**. The HA integration (`integrations/homeassistant`) is a thin shim that re-exposes Qalaam capabilities to HA users — but the standalone Qalaam SaaS / self-host installs work without HA at all.

Cast and AirPlay run in a Python sidecar (`services/device-bridge`) communicating over gRPC because no maintained Node libraries exist for those protocols. The TS `Adapter` interface in `packages/adapter-interface` is the contract; both Node and Python implementations satisfy it.

## Alternatives considered

1. **HA-only (Qalaam ships only as a HA integration).** **Rejected because** the user explicitly excludes this; also, the standalone SaaS / mobile flows require speakers to work without HA.

2. **One adapter per major vendor with no abstraction.** **Rejected because** every UI surface would need vendor-specific code; this violates CLAUDE.md Principle 02 ("Systems Over Features").

3. **Music Assistant as our backend (don't write adapters).** Tempting because MA already has all of these. **Rejected because** MA is HA-coupled in its current shipping form; while it can run standalone, embedding it adds significant operational and licensing complexity. We will however use MA as our reference implementation and as the recommended output abstraction *inside* the HA integration.

4. **Sendspin only (Music Assistant 2.7+).** Sendspin is exciting but tech-preview. **Re-evaluate** for v1.5 once GA.

## Consequences

### Positive

- Same UI code drives playback on any speaker the user owns.
- New adapters are additive — adding a future Matter Casting adapter doesn't touch UI code.
- The standalone SaaS gets every device HA can drive (via HA-as-adapter), without us maintaining 30 integrations.

### Negative

- Cast/AirPlay sidecar adds operational complexity (a Python service alongside the Node backend).
- Cross-process gRPC adds 5-15ms latency vs in-process calls.
- Two languages in the device-control path = more surface area for bugs.

### Neutral

- We track Music Assistant's evolution closely; if Sendspin succeeds, we may rebase on it.

## Risks & monitoring

- **Risk:** A protocol changes (Cast auth churn happened in 2024). **Leading indicator:** open issues on `pychromecast` / `pyatv` containing "broken" + reciter complaints in our error tracker. **Mitigation:** version-pin sidecar deps; subscribe to upstream issue trackers.
- **Risk:** gRPC bridge becomes a bottleneck. **Leading indicator:** end-to-end play latency > 500ms. **Mitigation:** in-process Python embed (via Node N-API or PyO3) is a fallback.

## References

- Strategy doc: §5 Multi-protocol device adapter layer, §20.4 Casting library updates
- Memory: `reference_device_adapters.md`
- External: music-assistant.io, github.com/home-assistant-libs/pychromecast, github.com/postlund/pyatv
- Related ADRs: ADR-0009 (backend language)
