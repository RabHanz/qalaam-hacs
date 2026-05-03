# `qalaam-realtime-feedback`

WebSocket service for live recitation feedback during the **verse-pause Hifdh drill** (per strategy §8.7).

## Privacy posture

This service is **on-device / on-LAN only** — same boundary as the ASR worker (per ADR-0005). It accepts streamed audio chunks via WebSocket and forwards them to the local ASR worker; only **derived signals** (per-word match results) flow back to the client.

Audio chunks NEVER cross the trust boundary into the SaaS backend. The schema layer (`packages/schema/schemas/asr/LocalAudioBuffer.schema.json`) enforces this architecturally — the cloud-sync envelope rejects any audio-bearing field.

## Endpoint

`WS /v1/feedback`

### Client → server frames

```json
{ "type": "session-start", "expected_verse_key": "1:1", "expected_text_uthmani": "بسم..." }
{ "type": "audio", "sample_rate": 16000, "samples_b64": "..." }
{ "type": "session-end" }
```

### Server → client frames

```json
{ "type": "partial", "transcript_so_far": "...", "matched_words": [0, 1] }
{ "type": "word-result", "word_index": 2, "is_match": true, "confidence": 0.92 }
{ "type": "complete", "summary": { ... } }   // AsrResult
```

## Outcome served

O-01 (mistake-detection latency, ≤ 3s p95 after end-of-utterance), O-02 (false-positive reduction via on-device + parent-override capture), O-03 (offline Hifdh).
