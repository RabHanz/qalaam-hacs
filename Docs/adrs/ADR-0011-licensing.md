# ADR-0011: Apache-2.0 for libraries, AGPL-3 for SaaS backend

- **Status:** Proposed
- **Date:** 2026-05-02
- **Deciders:** Founder (pending counsel review)
- **Outcome served:** All (legal foundation; protects open-core posture while preventing SaaS clones)
- **Consulted:** N/A (pending)
- **Informed:** Future contributors

## Context

Qalaam ships open-source libraries (`packages/*`) and a hosted SaaS backend (`apps/backend`). The licensing posture must:

1. Allow community contribution and embedding into other projects (researchers, mosques, education tech).
2. Protect commercial viability — prevent a competitor from rebranding our SaaS and reselling it.
3. Honor upstream license obligations: QUL is MIT, quran-align/quran-tajweed are CC-BY-4.0, Habibi-TTS-MSA is Apache-2.0, on-device ASR models are MIT/CC-BY-4.0.
4. Set a precedent that "Music Assistant" pattern (Apache for libraries, AGPL for the server) has established as workable for the smart-home ecosystem.

## Decision

We will license:
- **All `packages/*` (libraries) under Apache-2.0** — maximum reuse; defends contributors with patent grant; aligns with MIT/Apache upstreams.
- **`apps/backend` and `services/*` (the SaaS service binaries) under AGPL-3.0** — anyone running a copy as a service must publish modifications, preventing closed-source SaaS clones.
- **`apps/web` under AGPL-3.0** for the same reason.
- **`integrations/homeassistant` under Apache-2.0** — encourages HA-community fork-and-improve.
- **`apps/mobile` (Expo) under AGPL-3.0**.
- **`ml/`** — code under Apache-2.0; trained-checkpoint weights distribution per the upstream weight licenses.

Top-level `LICENSE` file references both with a per-directory map. `THIRD_PARTY_NOTICES.md` lists every dep with its license.

## Alternatives considered

1. **MIT everything.** Maximally permissive but allows zero-cost SaaS clones — strategic risk.
2. **AGPL-3 everything.** Allows community fork but blocks library embedding by Apache/MIT-licensed projects (HA core, etc.).
3. **Business Source License (BSL).** Considered; rejected because the Islamic-tech community values fully-open postures more highly than the commercial-protection upside.
4. **Dual MIT + Commercial.** Considered for the future; defer.

## Consequences

### Positive

- Clear posture both for contributors (libraries are reusable) and for commercial defense (SaaS competitors must open-source their forks).
- Music Assistant + Plausible + similar projects validate this pattern works in the OSS-SaaS market.

### Negative

- AGPL-3 is sometimes feared by enterprise legal teams; we may need a commercial-license offering for Pro tier later.
- Mixed licensing requires careful per-package review to avoid AGPL contagion into Apache packages.

### Neutral

- Contributor License Agreement (CLA) needed to allow future re-licensing if strategy shifts.

## Risks & monitoring

- **Risk:** A future Apache package accidentally imports an AGPL package, infecting the library posture. **Leading indicator:** `tooling/check-third-party-notices.ts` flags AGPL deps in Apache packages. **Mitigation:** CI check; explicit lint rule.
- **Risk:** Counsel disagrees with this allocation. **Mitigation:** ADR is Proposed; revisit before v0.1 ship.

## References

- Strategy doc: §10 Open question #1 (Qalaam license)
- External: opensource.org/licenses/Apache-2.0, opensource.org/licenses/AGPL-3.0, music-assistant.io
- Related ADRs: ADR-0001 (monorepo)
