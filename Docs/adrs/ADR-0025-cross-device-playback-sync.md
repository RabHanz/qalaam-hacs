# ADR-0025 — Cross-device playback sync (Spotify-Connect-style)

**Status:** Phase-1 + Phase-2 shipped; Phase-3/4 deferred per modular triggers.
**Date:** 2026-05-06
**Supersedes:** none. Extends ADR-0009 (Fastify), ADR-0023 (SQLite-only).

## Context

Today (post-deploy 2026-05-06):

- **Cast** works through `chrome.cast.framework` — single browser tab opens a session, loads a single audio URL, no automation after. Prior bugs:
  1. Local controls didn't proxy to the receiver — pressing play/pause on Qalaam paused local audio while the TV kept playing.
  2. Auto-advance fired on local `<audio onEnded>` only, so the receiver played one ayah and stopped.
  3. No state mirror — pausing on the TV remote left the Qalaam UI stuck on "playing".

- **Local HA panel** exposes Quran as an HA media-source; the user can browse + play through HA's media browser to any HA-aware speaker (Sonos, ESPHome, MPD…). Independent of Cast. No awareness of the user's web-side session.

- **AirPlay** is a native browser feature, no JavaScript control surface — once activated, the OS owns the session.

- **No multi-device sync** — two browser tabs, two phones, or a phone + TV remote can't share a session. There's no concept of "the user's currently-playing portion" across devices.

The user explicitly requested Spotify-Connect-style behavior:

> "make it sync across all devices locally on the network like spotify works, and also watch out for different user accounts if they are on the same network and have access to same devices, also the home assistant, it all needs to be well thought out and planned"

## Decision

Build a **server-mediated playback session** where Qalaam's backend is the source of truth for "what is this user playing right now," and devices subscribe via WebSocket for real-time mirror + send commands via HTTP.

The architecture is local correctness now, cloud-mediated sync next, HA integration last — three phases keyed to triggers per the production-layer plan.

## Phase 1 — Local correctness (this session, IN PROGRESS)

The `useCast` hook (apps/web/src/lib/use-cast.ts) wraps the Cast Framework's `RemotePlayer` + `RemotePlayerController`. MiniPlayer routes every command (play, pause, seek, loadMedia) through the hook when a session is active, and mirrors receiver state (currentTime, duration, isPaused) to its UI. The `onMediaEnded` subscription drives auto-advance — when the receiver finishes an ayah, the hook fires the handler, MiniPlayer calls `advance(1, true)`, the new audio URL loads on the receiver. Single-tab, single-user; the user gets a working local cast experience that doesn't drop after one ayah.

**Status:** shipped commit `a6f4190` + the cast-hook commit landing now.

## Phase 2 — Cross-device sync via cloud-mediated session (SHIPPED 2026-05-06)

Implementation chose **SSE** over WebSocket: one-way pushes are all
we need (commands go via REST POST), and EventSource gives free
auto-reconnect, native cookie auth, and zero new deps. The WS
sketch below remains accurate apart from that protocol swap.

Live surface:

- `playback_sessions` + `playback_devices` tables in `qalaam.sqlite`
  (auto-created on boot per `apps/backend/src/auth/db.ts`).
- `apps/backend/src/lib/playback-bus.ts` — in-memory pub/sub keyed
  by `user_id`, broadcasts state to each user's SSE subscribers.
- `apps/backend/src/routes/v1/playback.ts` — five endpoints:
  GET `/state`, POST `/command` (action ∈ play|pause|seek|load|
  transfer|sync), GET `/subscribe` (SSE), POST `/devices/heartbeat`,
  GET `/devices`. All gated by the new `playback.session.read` /
  `playback.session.write` feature keys.
- `apps/web/src/lib/use-playback-session.ts` — frontend hook with
  auto-reconnect EventSource, 60-second device heartbeat, command
  primitives. Dormant when `enabled: false` (anonymous users).
- MiniPlayer wires the hook in: every local play/pause/seek mirrors
  to the cloud session; remote state pushes from another device
  mirror back into local state via `qalaam:remote-reciter` window
  event + parent `onVerseKeyChange` callback. Echo-suppression via
  `activeDeviceId === deviceId` check.

Backend authoritative state:

```
TABLE playback_sessions
  user_id            TEXT PRIMARY KEY  -- owner of the session
  active_device_id   TEXT              -- "controller" right now
  reciter_slug       TEXT
  verse_key          TEXT              -- where playback is
  position_seconds   REAL
  is_paused          INTEGER           -- 0/1
  target             TEXT              -- 'local' | 'cast:<deviceId>' | 'airplay:<id>' | 'ha:<entity_id>'
  updated_at         INTEGER           -- millis since epoch
```

WebSocket endpoint `/v1/playback/subscribe`:

- Authenticated via the existing cookie session (same auth as REST).
- Server pushes `{event: 'state', payload: {...}}` whenever the row updates.
- Server also emits `{event: 'devices', payload: [{deviceId, name, capabilities, online}, ...]}` so each device can render the device-picker UI.

Command HTTP endpoints (gated by `playback.session.write` feature key):

- `POST /v1/playback/play` — `{position?: seconds}` — sets is_paused=0, broadcasts.
- `POST /v1/playback/pause`
- `POST /v1/playback/seek` — `{position}` — sets position_seconds, broadcasts.
- `POST /v1/playback/load` — `{verseKey, reciterSlug, target}` — replaces the playing item.
- `POST /v1/playback/transfer` — `{target}` — moves playback from one device to another (the SPOTIFY CONNECT primitive).

Each device:

1. On boot, registers itself: `POST /v1/playback/devices/heartbeat` with `{deviceId, deviceName, capabilities}`. Server records it.
2. Subscribes to the WebSocket for its user.
3. When user interacts with controls, send a command to the appropriate POST.
4. When the WS pushes a state update, mirror it locally — if `target === 'local:<thisDeviceId>'`, play locally; if `target === 'cast:<remoteId>'`, defer to cast; etc.

User-isolation guarantees:

- Sessions are keyed by `user_id`. Two users on the same WiFi with separate accounts don't share a session — each WS subscription only receives state for that user.
- Family-tier (per ADR-0024 family-tier feature gates): optional **shared household session** that family members opt into, with explicit "cast on the kitchen Sonos" UX. Backed by `family_id` row instead of `user_id`. Each member can override the shared session locally without losing the household sync (when they "un-pause" their override, sync resumes).

**Why server-mediated, not direct device-to-device:**

- mDNS / multicast peer discovery is unreliable across modern WiFi (client isolation, IPv4/IPv6 mixed). Spotify Connect uses Spotify's cloud for the same reason. Hetzner is fast enough that the round-trip is invisible.
- WebSocket auth is trivial via the existing cookie session — no separate device-pairing protocol.
- One source of truth makes "transfer playback" a one-row UPDATE; without it, the same operation is a peer-to-peer protocol nightmare.

Trigger for Phase 2:

- First household with two active devices (a parent's phone + a kid's iPad) — surfaces the "I want to start on my phone, finish in the kitchen" use case naturally.
- OR first paying customer (so we can justify the WebSocket infra cost).

## Phase 3 — HA integration as a peer device (DEFERRED — trigger: Phase 2 lands)

The HA integration becomes a **first-class device** in the session model:

- HA registers itself at `POST /v1/playback/devices/heartbeat` with its entity_id list ("kitchen sonos", "living room esphome", etc.) — each entity is a separate device in the session.
- When the user picks "kitchen sonos" in the Qalaam device picker, the backend transfers the session: `target = 'ha:media_player.kitchen_sonos'`.
- HA-side: the integration's coordinator picks up the transfer event, calls `media_player.play_media` with the audio URL.
- HA's own play/pause from the speaker (or HA UI) feeds back to the backend via the integration's status updates, and the user's phone UI updates via the WS.

This means the existing one-way HA media-source path (web → HA-only) becomes a bidirectional sync: every device controls every device. The HA premium API-key gate (#213) covers this — Phase 3 unlocks for Premium+ accounts.

## Phase 4 — Bonjour/AirPlay/Sonos discovery (DEFERRED — trigger: pro-tier launch)

For users who want device discovery WITHOUT a cloud round-trip (privacy preference, offline use):

- A locally-installable Qalaam Connect agent (Electron/Tauri or python daemon) on a household NAS or always-on machine.
- It hosts the WebSocket locally + speaks mDNS to discover Sonos/Cast/AirPlay/HA on the LAN.
- Phone connects to `qalaam.local:4111` instead of `qalaam.themarginapp.com`.
- Same protocol, just self-hosted. Aligned with the L2/L3 pro-tier path in the modular plan.

## Trade-offs accepted

- **Phase 1 doesn't cover multi-device or multi-user.** Casting from one tab while another tab on the same account thinks it's "playing" is still possible — the second tab won't know about the cast session until Phase 2. Logged + visible to the user via the existing "Casting" UI; not a regression vs. today.
- **WebSocket adds backend complexity** (per L4 — sustained writes/sec might trigger Postgres switchover earlier if the session table sees high write volume). Mitigation: write coalescing — position updates throttled to 1/sec, only flushed on actual state change.
- **Server-mediated sync is online-only.** When the household is offline, MiniPlayer falls back to local audio + local cast (Phase 1). The session resumes when connectivity returns; we surface a small "offline" indicator.
- **HA integration depends on the WebSocket being reachable from HA.** That's normally fine (HA → cloud). For air-gapped HA installs, Phase 4 is the answer.

## Implementation notes (Phase 2 sketch — to be expanded when triggered)

- Use Fastify's `@fastify/websocket` plugin (matches the existing v5 stack).
- The session row is hot — use `qalaam.sqlite` WAL mode + a single-writer per-user lock. SQLite's row-level isolation under WAL is sufficient for this write rate.
- Heartbeat-prune offline devices every 90 seconds to keep the device list current.
- All commands gated by feature keys: `playback.session.read` (free, anon-allowed for public listening surfaces), `playback.session.write` (free + auth required).

## Tracked tasks

- **#229 K11.** Phase 2: backend session table + WebSocket + REST commands. Trigger: first multi-device household OR first paying customer.
- **#230 K12.** Phase 3: HA integration as peer device. Trigger: Phase 2 lands.
- **#231 K13.** Phase 4: Local Connect agent (LAN-only mode). Trigger: pro-tier launch.

## Status by feature gate

Add to `apps/backend/src/auth/features.ts` once Phase 2 starts:

```ts
'playback.session.read':  { minTier: 'free',    requiresAuth: false, ... },
'playback.session.write': { minTier: 'free',    requiresAuth: true,  ... },
'playback.session.shared-household': { minTier: 'premium', requiresAuth: true, ... },
'playback.session.ha-bridge': { minTier: 'premium', requiresAuth: true, ... },
'playback.session.local-agent': { minTier: 'pro', requiresAuth: true, ... },
```
