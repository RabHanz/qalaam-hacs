# ADR-0017: i18n strategy — `next-intl` + RTL/LTR + dual-pipeline Voice

- **Status:** Proposed
- **Date:** 2026-05-02
- **Deciders:** Founder
- **Outcome served:** O-04 (parent cognitive load — multilingual households), O-19 (accessibility)
- **Consulted:** N/A
- **Informed:** Future contributors

## Context

Qalaam's target audience is global Muslim families. Common household languages:
English, Arabic, Urdu, Indonesian, Turkish, French, Malay, Persian. **Many
households are bilingual** — Arabic + one of the above.

Per strategy §20.2: HA Voice Chapter 11 (Oct 2025) shipped **two pipelines per
satellite** as a first-class feature. Qalaam should leverage this — Arabic for
recitation queries, English/Urdu/etc. for control commands.

## Decision

- **UI library:** **`next-intl`** for `apps/web`. Consumer locale detection via
  Accept-Language header → cookie persistence.
- **Translations:** ICU MessageFormat in JSON files under `apps/web/messages/<locale>.json`.
  Source-of-truth is `en.json`; other locales translated via professional
  service (paid) at v0.5 — never machine-translated for shipped strings.
- **Mobile (Expo, post v1.5):** `expo-localization` + same JSON catalog.
- **HA integration:** `strings.json` + `translations/<lang>.json` (HA's standard
  pattern). Ships with `en.json` v0.1; community contributions for others.
- **RTL handling:** `dir="auto"` + `unicode-bidi: plaintext` for mixed Arabic/
  English content. The `useDirection` hook in `@qalaam/ui` reads the
  documentElement attribute. CSS uses logical properties (`margin-inline-start`
  not `margin-left`) where possible.
- **Voice (HA Voice Chapter 11):** declare TWO pipelines per satellite — one
  Arabic, one user's primary language. Sentences in `custom_sentences/<lang>/qalaam.yaml`.
- **Hijri / numerals:** display Hijri date alongside Gregorian; Arabic numerals
  (Hindu-Arabic ٠١٢٣٤٥٦٧٨٩) when locale is Arabic, Latin numerals otherwise.

## Alternatives considered

1. **`react-i18next`.** Considered. **Rejected** because `next-intl` is
   purpose-built for Next.js 15 RSC + App Router and handles the
   metadata/title locale-routing better.
2. **Embedded translation catalogs in source code.** **Rejected** — translators
   need to edit JSON files, not TypeScript.
3. **Machine translation for shipped strings.** **Rejected** for primary
   language ramp; OK for "draft" markers in v0.1 dev tooling only.

## Consequences

### Positive

- One translation pipeline across web + mobile + HA + ha-panel.
- Bilingual households first-class via dual Voice pipelines (the Voice Chapter
  11 win).
- Logical CSS makes RTL effectively free post-token migration.

### Negative

- Per-language file growth (~15 KB per locale at v0.5; ~25 KB at v1.5 with the
  full Hifdh + curriculum strings).
- Professional translation cost (~$0.10/word × ~3K words/locale × 8 locales =
  ~$2,400 one-time at v0.5, plus updates).

### Neutral

- We accept the first-bilingual-tier scope: Arabic + English + Urdu at v0.5;
  French, Indonesian, Turkish, Malay, Persian at v1.0.

## Risks & monitoring

- **Risk:** Translator drifts from the canonical Qalaam tone (calm, scholarly,
  family-warm). **Mitigation:** ship a 1-page tone guide alongside the JSON;
  reviewer-of-record (a native speaker who's aligned with the Qalaam ethos).
- **Risk:** Community PRs add machine-translated content. **Mitigation:** PR
  template requires "Translator: <name + native-speaker affirmation>"; CI
  rejects merges from auto-translation services' default git author strings.

## References

- Strategy doc: §11.7 (accessibility), §20.2 (HA Voice Chapter 11 dual-pipeline)
- External: next-intl-docs.vercel.app, w3.org/International/articles/
