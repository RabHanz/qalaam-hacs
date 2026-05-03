# ADR-0006: Habibi-TTS-MSA (Apache-2.0) over F5-Emilia for voice cloning starting checkpoint

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** O-06 (reciter voice cloning), O-18 (prosody comparison)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

The November 2024 strategy doc selected F5-TTS as the production TTS pick. Refresh research in May 2026 (§20.5) shows:

- **F5-TTS code** is still excellent (MIT) but the **original Emilia-trained weights are CC-BY-NC** — non-commercial only, blocking SaaS use.
- **Habibi-TTS (X-LANCE/SJTU, Jan 2026)** — built on F5-TTS, trained with stage-wise curriculum (95K hrs CN+EN → MSA → 12 dialects). The **MSA model is Apache-2.0**, the unified/SAU/UAE variants are CC-BY-NC-SA.
- **VoxCPM2 (OpenBMB, Apr 2026, Apache-2.0)** — fine-tunes on as little as 5-10 min audio, 48 kHz, 30 langs incl. Arabic.
- **CosyVoice 2 (Apache-2.0)** — 150ms streaming TTFB, identical streaming/non-streaming quality.
- **Chatterbox Multilingual (MIT, native Arabic)** — most permissive Arabic-native option.

Tarteel still has not open-sourced their production TTS/ASR. We must build our own.

## Decision

We will use **Habibi-TTS MSA (Apache-2.0)** as the starting checkpoint for voice synthesis, fine-tuned on **EveryAyah** + **QUL audio** for Quranic-specific prosody. This forms the basis of the **Qalaam-house voice** (per ADR-0007 — multi-reciter blend, unattributed).

For **streaming TTS** (verse-pause Hifdh drill, where 150ms TTFB matters), we will use **CosyVoice 2** with Arabic LoRA, because Habibi/F5 are non-autoregressive and cannot stream-generate.

For **MVP** (per ADR-0014), v0.1-v1.0 voice generation uses **ElevenLabs API** (cheaper than self-hosting until ~5K active users); we switch to self-hosted Habibi at break-even.

## Alternatives considered

1. **F5-TTS Emilia weights.** **Rejected because** CC-BY-NC blocks commercial use.

2. **Train F5-TTS from scratch on commercially-licensed data.** **Rejected because** Habibi already did this for Arabic with state-wise curriculum; reinventing wastes 6+ months.

3. **VoxCPM2 as starting checkpoint.** **Strongly considered.** Pilot in parallel with Habibi; **VoxCPM2 wins for low-data fine-tuning** of a single-reciter clone (5-10 min sufficient). Decision: ship Habibi as default Qalaam-house voice; offer VoxCPM2 as the engine for opt-in user-voice cloning (ADR-0007).

4. **Chatterbox Multilingual.** Most permissive license. **Held as fallback** if Habibi licensing changes or quality regresses.

5. **ElevenLabs as permanent provider.** **Rejected as long-term** because per-character pricing eats gross margin at scale (>5K active users); also white-labeling forfeits the data flywheel from custom fine-tuning. Acceptable as MVP only (ADR-0014).

6. **OmniVoice (Apache-2.0, 600 langs).** Considered. **Rejected as default** because no Arabic-specific advantage; revisit if a Quranic fine-tune emerges.

7. **Spark-TTS / IndexTTS / MaskGCT / MegaTTS 3 / Fish S2 / MARS5 / Kyutai (no Arabic).** **Rejected on license** (NC, NC-SA, AGPL, paid commercial) or language coverage.

## Consequences

### Positive

- Apache-2.0 = unambiguous commercial use.
- F5-architecture lineage means existing F5 fine-tuning pipelines apply (Habibi extends F5).
- Multiple Arabic community fine-tunes (IbrahimSalah, MAdel121) provide reference recipes.
- Qalaam-house voice (multi-reciter blend) sidesteps reciter copyright entirely (ADR-0007).

### Negative

- We must train and maintain our own checkpoint (`qalaam/habibi-quran` on HuggingFace).
- GPU cost for fine-tuning (one-off ~$200-500 on RTX 5090 for initial; less for incremental).
- Streaming requires a different model (CosyVoice 2) — two models in production.

### Neutral

- We track the open-source Arabic TTS landscape closely; if a better option emerges, migration cost is low (Habibi → next is mostly weights, not architecture).

## Risks & monitoring

- **Risk:** Habibi MSA license changes from Apache-2.0. **Leading indicator:** github.com/SWivid/Habibi-TTS LICENSE diff or HF model card update. **Mitigation:** snapshot weights to Cloudflare R2 with a license clause asserting our existing Apache-2.0 grant.
- **Risk:** Fine-tuned voice quality is below 4/5 native-speaker blind test (per §26.5). **Leading indicator:** beta-tester audio ratings. **Mitigation:** (a) pilot VoxCPM2 in parallel; (b) extend training data with QUL human-corrected segments; (c) accept ElevenLabs as long-term provider if self-host quality bar isn't reached.
- **Risk:** Per-verse generation latency exceeds UX budget. **Leading indicator:** p95 > 1s for cached, > 3s for cold. **Mitigation:** aggressive pre-generation + Cloudflare R2 cache; the top 100 verses × 10 reciters cover ~60% of requests.

## References

- Strategy doc: §8 AI/ML stack, §20.5 TTS/ASR delta
- Memory: `reference_2026_ai_stack.md`
- External: https://github.com/SWivid/Habibi-TTS, https://huggingface.co/SWivid/Habibi-TTS
- Related ADRs: ADR-0007 (Qalaam-house voice posture), ADR-0014 (ElevenLabs MVP), ADR-0005 (on-device ASR)
