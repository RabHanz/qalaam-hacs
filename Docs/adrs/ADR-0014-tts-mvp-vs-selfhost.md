# ADR-0014: Voice cloning — ElevenLabs API for MVP, switch to self-hosted Habibi at ~5K active users

- **Status:** Proposed
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** O-06 (reciter voice synthesis), economics
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

ADR-0006 selected Habibi-TTS-MSA as the long-term self-hosted TTS checkpoint. However, self-hosting requires GPU infra (RTX 5090 or cloud equivalent), Triton serving setup, fine-tuning runs, and ongoing operational overhead. For an early-stage product validating PMF, this is premature.

Per §20.5.5 economics:
- ElevenLabs Creator $22/mo → ~$30-50 per 1M characters.
- Per active Hifdh user generating 50 verses/day at ~150 chars/verse ≈ 7,500 chars/day ≈ **~$0.25/user/month**.
- Self-host break-even ≈ **5,000 active users** (or ~8-15M chars/month).

## Decision

For the **voice-cloning MVP path (v0.5 - v2.0)**:
- Use **ElevenLabs API** as the TTS provider for the Qalaam-house voice (per ADR-0007 framing).
- Aggressively cache to Cloudflare R2 (top 100 verses × all reciters pre-generated → ~60% cost reduction per §12.4).
- Watermark all AI-generated audio for US AI Voice Rights Act compliance (per ADR-0007).

**Switch to self-hosted Habibi-TTS** when:
- Active users exceed 5,000, OR
- Monthly TTS spend exceeds $1,500, OR
- ElevenLabs license terms become incompatible with our use case.

The switch is architecturally one-line (`services/tts-worker/src/providers/`) — provider swap behind the same gRPC interface.

## Alternatives considered

1. **Self-host Habibi from day one.** **Rejected** because GPU infra cost ($800+/month for 24/7 RTX 5090) exceeds projected ElevenLabs cost until ~5K users; opportunity cost on engineering time is higher.
2. **Inworld TTS-1.5 Mini.** Comparable pricing, lower latency. **Hold as alternative MVP** if ElevenLabs license terms prove restrictive.
3. **Fish Audio S2 / OpenAI gpt-realtime API.** **Rejected** for cloning — Fish requires research-only weights or paid commercial; OpenAI doesn't allow custom voice cloning.
4. **Skip cloud APIs, ship without TTS in MVP.** **Rejected** because O-06 is opportunity = 13; voice synthesis is part of the core value prop.

## Consequences

### Positive

- Zero GPU operational overhead in v0.5 - v1.5.
- Sub-300ms latency from ElevenLabs (production-quality).
- Caching layer + watermarking pipeline already required for self-host — built once, reused.
- Switch path is explicit and parameterized.

### Negative

- ElevenLabs is a vendor dependency; outages affect us.
- Per-character cost is variable — must cache aggressively to maintain unit economics.
- No data flywheel from ElevenLabs (we don't train them; they don't train us).

### Neutral

- Once we self-host, the data flywheel benefits compound (per §24).

## Risks & monitoring

- **Risk:** ElevenLabs ToS forbids our use case (Quran content, voice cloning of revered figures). **Leading indicator:** ToS review by counsel; outreach to ElevenLabs Account Manager. **Mitigation:** Inworld as fallback; accelerate self-host.
- **Risk:** ElevenLabs pricing changes erode the cost win. **Leading indicator:** pricing-page change. **Mitigation:** self-host migration plan is documented and ready.
- **Risk:** Caching hit rate < 60%. **Leading indicator:** TTS spend trending up faster than user growth. **Mitigation:** pre-generate top-1000 verses (vs top-100); per-user portion pre-generation.

## References

- Strategy doc: §20.5.5 ElevenLabs vs self-host break-even, §22 Reciter licensing
- External: elevenlabs.io/pricing
- Related ADRs: ADR-0006 (Habibi long-term), ADR-0007 (Qalaam-house voice posture), ADR-0010 (R2 storage)
