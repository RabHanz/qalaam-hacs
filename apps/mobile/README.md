# `apps/mobile` — Qalaam mobile (Expo SDK 53)

Per Phase 12 + ADR-0013. v1.5 surface — first slice ships the **reader,
deep-study (with WBW + mutashabihat watchlist), and Hifdh dashboard**
hitting the live Fastify backend.

## Run

```bash
cd apps/mobile
pnpm install
pnpm start
# then press i (iOS sim) / a (Android emu) / w (web)
```

The app reads `apiBase` from `expo-constants` `extra`. To point at a
LAN-accessible backend (so a phone on the same WiFi can hit your dev
machine):

```bash
APP_API_BASE=http://192.168.1.10:4111 pnpm start
```

(or set `extra.apiBase` in `app.json`).

## Routes

- `/` — surah picker (114 surahs from `/v1/metadata/surahs`)
- `/read/:surah` — full surah from `/v1/chapters/:id/verses`
- `/study/:verseKey` — verse + word-by-word + mutashabihat watchlist
- `/hifdh` — streak + portions due + watchlist

## Deferred to v1.5+

- On-device ASR via React Native bridge to faster-whisper (Phase 12.4)
- Offline package download (~1.5 GB Opus audio for 1 reciter)
- iOS TestFlight + Play Internal upload
