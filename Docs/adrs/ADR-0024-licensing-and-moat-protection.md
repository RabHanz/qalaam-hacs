# ADR-0024 — License switch from AGPL-3.0 to Qalaam Proprietary; HA integration tier-gated by Premium API key

**Status:** Accepted
**Date:** 2026-05-06
**Deciders:** Rabee
**Supersedes:** parts of ADR-0011 (mixed-license allocation)
**Related:** ADR-0023 (production stack), strategy §17 (SaaS substrate), §29 (deploy)

## Context

Qalaam ships a unique bundle of features no other product currently
offers as a single integrated experience:

- Hifdh-first family-tier (per-child plans, parent dashboard, mistake
  heatmap, family khatm wall, voice notes + praise stickers)
- Recite-and-check ASR with on-device privacy guarantees
- Editorial-scripture UI/UX (Fraunces + Plex + Amiri Quran, gold-foil
  details, warm-paper aesthetic)
- Multi-mode Mushaf rendering (KFGQPC V4 tajweed COLR/CPAL fonts,
  Madinah, IndoPak, image-mushaf with overlays)
- Adhan + qibla + Hijri + azkar bundled with the same household
  device surface
- HA integration with custom panel + media-source + sensors + services
- MCP-routed Quranic tooling (`mcp.quran.ai`)

The previous license allocation (ADR-0011) put `apps/*` + `services/*`
under AGPL-3.0. AGPL is a strong-copyleft license — anyone running
the code as a service must publish their entire codebase under AGPL
too — but it is still **open source**. A motivated competitor can
fork the repo, reskin it, and run a derivative service in a
jurisdiction with weak AGPL enforcement, or simply copy patterns from
the public source without redistributing.

Per the user's explicit direction: "no one else is shipping all of
the features we are in a bundle like us, so we must close source
whatever we can that is our own and only attribute the resources we
used."

Separately, the Home Assistant integration has a deployment problem:
HA Core's contribution requires Apache 2.0 / MIT compatibility, and
HACS-distributed integrations want permissive licenses. We can't
close-source the integration code without losing the HACS path.

## Decision

### Code license allocation

| Subdirectory                              | Old (ADR-0011) | New (this ADR)         |
| ----------------------------------------- | -------------- | ---------------------- |
| `apps/*` (web + backend)                  | AGPL-3.0       | **Qalaam Proprietary** |
| `services/*` (asr, tts, etc.)             | AGPL-3.0       | **Qalaam Proprietary** |
| `packages/*` (utility libs)               | Apache 2.0     | Apache 2.0 (unchanged) |
| `integrations/homeassistant/*`            | Apache 2.0     | Apache 2.0 (unchanged) |
| `tooling/*`                               | Apache 2.0     | Apache 2.0 (unchanged) |
| `ml/*` (code; weights tracked separately) | Apache 2.0     | Apache 2.0 (unchanged) |

The new `LICENSE-PROPRIETARY` file at the repo root spells out the
exact terms. Headline:

- **Free** for personal study, audit, single-household self-host, and
  pull-request contributions.
- **Paid commercial license required** for any organizational,
  hosted-service, school/mosque/halaqah, or for-profit deployment.
- **No redistribution** of the proprietary code or modified versions
  without written permission.
- **No use as ML training data** for competing products.

### HA integration model — free client, paid backend

The Home Assistant integration code (`integrations/homeassistant/*`)
stays Apache 2.0 so it can be:

- Distributed via HACS (which prefers permissive licenses),
- Submitted to home-assistant/core if we want eventual official
  blessing,
- Contributed back to by the community.

The integration itself is a **thin client**. It provides no value
without the Qalaam backend. Tier-gating happens at the **backend**:

- The integration accepts a Qalaam API key in its config flow.
- Each `/v1/*` route the integration calls validates the API key,
  resolves it to a user, and checks `user.tier` against the route's
  required tier.
- **Free tier** (anonymous or `tier=free`) → prayer times, basic
  Mushaf reading, public ayah-of-the-day, qibla, Hijri date.
- **Premium tier** → family roster, mistake heatmap, khatm wall,
  voice notes, Listen Mode now-playing, sensor surface for
  family-private state.
- **Pro tier** → adds voice cloning + per-student weekly review.

The integration is free; **the infrastructure it talks to is the
paid product**. This matches the philosophy already in ADR-0023
("self-host friendly = single mountable file, but the SaaS still
sells the operational surface").

### Repository visibility

Switch `RabHanz/qalaam` from public → private. Rationale: even with
the proprietary license, public source means a competitor can read
the patterns and reimplement them without redistributing our code —
the license stops redistribution, not learning. Private repo + the
proprietary license + tier-gated API together form a real moat.

The Dokploy GitHub binding `Gjon1h6vbkMyhrscwH0dY` already has
authorization for the RabHanz org; flipping to private does not
break the deploy pipeline (it does require re-installing the GitHub
App scope on the now-private repo).

## Consequences

**Positive:**

- The unique bundle is protected. Reading the source is OK; running
  it commercially is licensed.
- HACS path stays clean — the integration is permissively licensed,
  the moat is in the gated backend.
- The "free for self-host single-household + paid for organizations"
  framing is honest, generous, and revenue-aligned.
- Privacy contract holds — the integration gating happens at the
  backend, not by phoning home from the integration itself.

**Negative / risks:**

- We give up AGPL's social-reciprocity nudge. Mitigated by the fact
  that the Proprietary License is more enforceable than AGPL ever
  was; the AGPL "share-your-changes" clause is rarely exercised in
  practice anyway.
- The integration's permissive license means a determined competitor
  could fork the integration, point it at their own Quran-data API,
  and skip our backend entirely. Mitigated by:
  - The integration's UI labels are Qalaam-branded (modifying them
    requires a fork they then have to maintain).
  - Most of the integration's value (family-tier, mistake heatmap,
    voice notes, etc.) is from our backend's data — there's nothing
    to "skip the backend" toward.
- Migration step needed for any existing community fork / install of
  the AGPL versions. Mitigated: there are no known forks in the wild
  (codebase is < 6 months old + has not been promoted yet).

## Migration

1. Replace root `LICENSE` allocation summary (this commit).
2. Add `LICENSE-PROPRIETARY` at repo root.
3. Remove or supersede the old `LICENSE-AGPL-3.0` file at repo root
   (AGPL is no longer in the allocation).
4. Update `Docs/adrs/ADR-0011-licensing.md` to mark superseded by
   this ADR.
5. Submit a tracked task (#215) to flip GitHub visibility to private
   after the license commit lands.
6. Track the API-key gate as #213 — the gate is the legal-bone of
   the new model; until it's live, the HA integration runs against
   the existing cookie-session backend.

## Notes for future decisions

- **If we ever want to relicense back to permissive** for any
  subdirectory, we must obtain CLA-equivalent permission from every
  contributor since the proprietary license took effect. The
  contribution clause in `LICENSE-PROPRIETARY` §4 grants us that
  authority preemptively, but contributors should be informed in
  the PR template.
- **Apache 2.0 sub-trees are permanent** — once a community fork
  exists under Apache 2.0, the original maintainers can't pull it
  back. That's by design for `packages/` + `integrations/` so the
  community can keep developing the periphery.
- **Upstream data licenses** (QUL, KFGQPC, public-domain
  translations) flow through unchanged — they're not "ours" to
  relicense. The `/credits` page enumerates each.
