# `qalaam-asr-worker`

On-device ASR worker. Per **ADR-0005** (privacy-first ML).

## Privacy guarantee

This worker is designed to run on the **user's device** (or a trusted LAN node).
Audio buffers are accepted via WebSocket / multipart upload, processed locally,
and discarded immediately. Only **derived signals** (`AsrResult` per
`packages/schema/schemas/asr/AsrResult.schema.json`) are returned to the caller.

In SaaS dev/test mode the worker may run in a container for end-to-end testing,
but production ALWAYS deploys this on-device or on the family's LAN.

## Model

Default: `tarteel-ai/whisper-base-ar-quran` via `faster-whisper`. Override
via `ASR_MODEL_ID` env. Alternatives:
- `tarteel-ai/whisper-tiny-ar-quran` (CPU-OK)
- `KheemP/whisper-base-quran-lora` (diacritic-sensitive)
- `TBOGamer22/wav2vec2-quran-phonetics` (word-level mistake detection)

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Liveness + model name + readiness |
| `POST` | `/v1/transcribe` | Multipart audio upload → `AsrResult` |
| `WS`  | `/v1/stream` | Streaming transcribe for verse-pause drill |

The architectural privacy boundary is enforced in two places:
1. The worker NEVER posts audio anywhere.
2. The result schema (`AsrResult`) is the only thing it returns; the cloud-sync
   schema lint forbids carrying audio fields (per `tooling/scripts/check-privacy-boundaries.ts`).
