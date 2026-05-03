# ADR-0007: Qalaam-house voice (multi-reciter blend) over named-reciter cloning through v1.5

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Founder + (pending) legal counsel
- **Outcome served:** O-06 (reciter voice synthesis), O-11 (theological soundness — adb), legal/ethical
- **Consulted:** N/A — to be reviewed by Islamic-law scholar before public launch
- **Informed:** Future contributors

## Context

The original AI vision (`quranic_recitation_ai_research_roadmap.md`) called for cloning specific named reciters (Sheikh Mishary Alafasy, Abdul Basit, Husary, Sudais, Minshawi). 2026 legal landscape (per §22.1) makes this risky:

- **Tennessee ELVIS Act (2024)** — extends right-of-publicity to AI voice clones.
- **US AI Transparency and Voice Rights Act (early 2026)** — federal disclosure requirement for AI-generated voices in commercial contexts.
- **WIPO 2025 report** — voice cloning cases up 300% YoY since 2023.
- **NY Court ruling (Skadden, July 2025)** — voice clones can violate right of publicity even without name use.
- **No fatwa or scholarly ruling specifically on reciter voice cloning** has surfaced in public English-language sources for 2025-2026.
- **No reciter or estate has publicly issued an AI-clone license.** Distribution permission for recordings is **not** the same as cloning permission.
- **GCC jurisdictions** (Saudi, Kuwait, UAE) are receptive to right-of-publicity claims under personality-rights doctrine — relevant given the target audience and the reciters' origins.

## Decision

Through **v1.5**, Qalaam will ship two voice-cloning product framings only:

1. **Default — Qalaam-house voice (all tiers).** A multi-reciter-blend Murattal-style voice trained from a corpus of multiple reciters in our training data, presented as an unattributed "Qalaam house voice" that does not claim to be any individual reciter. Avoids right-of-publicity issues entirely.

2. **Pro tier — opt-in user-voice cloning.** Lets students/parents/teachers clone *their own* voice (or a teacher's voice with explicit documented consent + signed release). Privacy-vault stored on user-device or encrypted cloud. Right-of-publicity is not implicated when the subject consents.

**Named reciter voices are deferred to v2.5+,** parallel-tracked with formal licensing engagement (Mishary's Alafasy Foundation, Saudi Presidency of the Two Holy Mosques, deceased-reciter estates via Darussalam etc.).

All AI-generated audio is **watermarked** (inaudible perceptual + visible "AI-generated" UI badge) for US AI Transparency Act compliance.

## Alternatives considered

1. **Ship named-reciter voice clones in v1.0.** Tempting because it's the most emotionally compelling demo. **Rejected because** right-of-publicity exposure in US + GCC + EU; potential fatwa backlash; no licensing in place.

2. **Ship named-reciter clones marked "experimental, not for distribution."** **Rejected because** even private use can trigger right-of-publicity under personality-rights doctrine; the marketing optics of "we made a Sudais voice" leak immediately.

3. **No voice cloning at all.** **Rejected because** O-06 + O-18 are opportunity = 13 + 15; this is core differentiation (§21.12).

4. **Wait for fatwa / industry-wide license framework.** **Rejected as a blocker** but **adopted as a parallel track** (we engage scholars and reciter offices now; ship Qalaam-house voice in the meantime).

## Consequences

### Positive

- Zero right-of-publicity exposure in v1.0-v1.5.
- Sidesteps a potential fatwa controversy that could harm the brand on launch.
- The "Qalaam-house voice" positioning is honest (we don't claim to be Sheikh X) and theologically defensible (cloning a specific named living scholar's voice raises ghibah/honor concerns that an unattributed voice does not).
- Opt-in user-voice cloning with consent is the genuinely novel feature (clone your teacher / your father / yourself) — emotional moat per §21.12.

### Negative

- Loses the "hear Sheikh Sudais say any verse" demo.
- Marketing must explicitly NOT promise specific reciter voices.
- Must train the Qalaam-house voice from scratch (one-off cost; ADR-0006 covers the technical path).

### Neutral

- We commit to publishing the legal + theological reasoning publicly, so users understand why this posture is principled, not merely cautious.

## Risks & monitoring

- **Risk:** A competitor ships named-reciter clones first and we look behind. **Leading indicator:** App Store reviews of Qalaam asking "where's Sheikh X's voice?" **Mitigation:** narrative ("Qalaam built it the right way — with consent and licensing"); reciter-licensing track moves faster as a result.
- **Risk:** A fatwa is issued *against* AI voice synthesis of recitation generally. **Leading indicator:** scholarly-X / Islamic-Twitter discussion. **Mitigation:** we have scholars on advisory; pivot to "user-voice only" if needed.
- **Risk:** Watermarking degrades audio quality perceptibly. **Leading indicator:** A/B audio rating regressions. **Mitigation:** test multiple watermarking schemes (inaudible spread-spectrum vs metadata-only).
- **Risk:** Reciter-licensing engagement fails to produce any signed agreement by v2.5. **Leading indicator:** > 6 months no response from any office. **Mitigation:** ship v2.5 with Qalaam-house voice + opt-in user cloning indefinitely; that's still differentiated.

## References

- Strategy doc: §22 Reciter Voice-Licensing Playbook, §20.5 TTS landscape
- Memory: `reference_2026_ai_stack.md`
- External: Tennessee ELVIS Act (2024), US AI Transparency and Voice Rights Act (2026), Skadden NY voice-clone analysis
- Related ADRs: ADR-0006 (Habibi-TTS checkpoint), ADR-0014 (ElevenLabs MVP)
