# `qalaam-tts-worker`

TTS provider service. Per **ADR-0006** (Habibi long-term) + **ADR-0014** (ElevenLabs MVP) + **ADR-0007** (Qalaam-house voice posture).

## Provider switch

`TTS_PROVIDER` env selects implementation:

| Value | Provider | When |
|---|---|---|
| `elevenlabs` (default) | ElevenLabs API | MVP — first ~5K active users (per ADR-0014 break-even) |
| `habibi` | Habibi-TTS-MSA self-host | Post break-even; needs RTX 5090-class GPU |
| `inworld` | Inworld TTS-1.5 | Fallback if ElevenLabs ToS becomes restrictive |

## Watermarking

Every generated clip is watermarked per ADR-0007 (US AI Voice Rights Act 2026):
- Inaudible perceptual watermark (spread-spectrum, sub-threshold)
- Visible "AI-generated" badge in API response metadata

## Posture

Per ADR-0007: v0.1 - v1.5 ships ONLY the **Qalaam-house voice** (multi-reciter blend, unattributed). Named-reciter clones are gated behind `LICENSED_RECITERS` env (empty by default) and require explicit reciter-licensing engagement.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Liveness + active provider + voice catalog summary |
| `POST` | `/v1/synthesize` | `{ text, voice_slug, opts }` → audio + signed cache URL |
| `GET` | `/v1/voices` | List allowed voice slugs |
