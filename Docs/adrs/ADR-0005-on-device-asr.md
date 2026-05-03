# ADR-0005: On-device ASR (Whisper-Quran-LoRA) for mistake detection

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** O-02 (false-positive reduction), O-03 (offline Hifdh — opportunity = 16, highest in §23.2)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

Tarteel's mistake-detection feature uses cloud ASR (server-side Whisper / NeMo fine-tunes). The #1 functional review complaint about Tarteel (§21.10) is **internet dependency** — users on planes, in masjid Wi-Fi dead zones, or in rural areas can't run a Hifdh session.

The strategy already calls for on-device ASR (§7.5 + §2 pillar 8 "Privacy-first ML"). 2026 brought viable open-weights Quran-tuned ASR models small enough to run on phones:

- `tarteel-ai/whisper-base-ar-quran` (~74M params)
- `tarteel-ai/whisper-tiny-ar-quran` (~39M params, CPU-OK)
- `KheemP/whisper-base-quran-lora` (~74M, ~6% WER, diacritic-sensitive)
- `TBOGamer22/wav2vec2-quran-phonetics` (phonetic, for word-level mistake detection)
- `IbrahimSalah/Wav2vecLarge_quran_syllables_recognition` (syllable-level)

Inference frameworks: `faster-whisper` (CUDA), `mlx-whisper` (Apple Silicon, 2× faster than whisper.cpp on M-series), `whisper.cpp` (CPU/Metal/edge fallback).

Forced alignment for word-level highlighting: `MahmoudAshraf97/ctc-forced-aligner` (Wav2Vec2/HuBERT/MMS-backed; modern default over MFA).

Privacy is non-negotiable: family households will have a child reciting Quran into a microphone; the audio cannot ship to cloud.

## Decision

We will run **on-device ASR using `tarteel-ai/whisper-base-ar-quran` (or `KheemP/whisper-base-quran-lora` for diacritic-sensitive mistake detection)** via `faster-whisper` (or `mlx-whisper` on Apple Silicon). Forced alignment via `MahmoudAshraf97/ctc-forced-aligner`. Audio **never** leaves the device.

Only **derived signals** (`MistakeEvent` records: verse_key, word_index, error_type, timestamp, reciter_id) sync to the backend. The cloud-sync transport schema (defined in `packages/schema`) **rejects audio-bearing fields** at the type level — privacy is enforced architecturally, not just by policy.

## Alternatives considered

1. **Cloud ASR (Whisper-large-v3 server-side, like Tarteel).** **Rejected because** internet-dependency complaint is opportunity = 16 (highest); cloud audio raises privacy concerns disproportionate to the latency benefit.

2. **Tarteel's own commercial NeMo/Riva model.** **Rejected because** Tarteel has not open-sourced their production ASR (confirmed May 2026); they explicitly said QUL does not include their AI assets.

3. **Skip mistake detection in v0.1.** **Rejected because** O-01 (mistake detection latency) is opportunity = 13; this is core Hifdh value.

4. **Wait for `gpt-4o-transcribe` cloud quality.** **Rejected because** API-dependent + cloud-audio + cost-per-request — wrong shape for our family-private use case.

## Consequences

### Positive

- Solves Tarteel's #1 review complaint at the architectural level — works on a plane, in the masjid, off-grid.
- Defensible privacy posture (audio never leaves device) — strong family/parental trust signal.
- No per-request inference cost (gross margin not exposed to ASR usage).
- Aligns with CLAUDE.md Principle 06 "Build for the Foundation" — privacy-by-architecture is hard to retrofit.

### Negative

- Larger app bundle (model is ~150 MB compressed). Mitigation: lazy-download on first Hifdh session opt-in.
- Higher device CPU/battery use during sessions. Mitigation: throttle, monitor (≤ 5%/hour mobile per §26.3).
- ~6% WER vs Tarteel's likely ~3-5% — accept the gap; the privacy + offline win dominates.

### Neutral

- Word-level mistake detection (forced alignment) deferred to v1.5; v1.0 ships verse-level + ayah-completion drill.

## Risks & monitoring

- **Risk:** Model accuracy is below 80% mistake-detection precision in real-world child voices. **Leading indicator:** user-correction overrides (§24.4) > 30% of flagged mistakes. **Mitigation:** fine-tune on collected child-voice data; offer parent-supervised manual mode.
- **Risk:** Battery drain alienates users. **Leading indicator:** opt-in rate < 50% after first attempt; battery-drain reports > 5%/hour. **Mitigation:** Voice Activity Detection (VAD) gates the model; throttle to half-second windows.
- **Risk:** Model checkpoint becomes unavailable on HF. **Leading indicator:** HF downtime or model deletion. **Mitigation:** mirror to Cloudflare R2; watermarked + integrity-checked.

## References

- Strategy doc: §7.5 On-device ASR pipeline, §20.5 TTS/ASR delta
- Memory: `reference_2026_ai_stack.md`
- External: https://huggingface.co/tarteel-ai/whisper-base-ar-quran, https://huggingface.co/KheemP/whisper-base-quran-lora, https://github.com/MahmoudAshraf97/ctc-forced-aligner
- Related ADRs: ADR-0009 (Python for ML), ADR-0006 (Habibi-TTS for synthesis)
