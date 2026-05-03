/**
 * License metadata for QUL-ingested resources.
 *
 * Per ADR-0020 + Docs/research/qul-inventory.md §3, every ingested row carries
 * a `LicenseTag` so downstream consumers (mobile binary, public API responses,
 * SaaS tier gating) can apply the right rules:
 *
 *   - `public-domain`           — bundle freely, no attribution required.
 *   - `factual`                 — facts (verse counts, juz boundaries) — same
 *                                 effective freedom as public-domain in most
 *                                 jurisdictions; we attribute QUL anyway.
 *   - `permissive-with-credit`  — MIT / CC-BY style; bundle anywhere, must
 *                                 credit upstream in Settings → Data Sources.
 *   - `kfgqpc-terms`            — King Fahd Glorious Quran Printing Complex
 *                                 reuse terms; permitted for non-commercial
 *                                 Quran apps, restrictive on font modification.
 *   - `digitalkhatt-anane`      — Dr. Amin Anane attribution required.
 *   - `gpl-derivative`          — derived from Kais Dukes' Quranic Arabic
 *                                 Corpus; copyleft. NEVER bundle into a
 *                                 closed-source mobile binary; service-only
 *                                 use is acceptable when the service is AGPL.
 *   - `per-translator`          — translation-by-translation review required.
 *   - `per-reciter`             — reciter audio licensing varies; check
 *                                 `reference_2026_ai_stack.md` playbook
 *                                 before shipping in any paid SaaS tier.
 *   - `unverified`              — placeholder; the ingest pipeline must
 *                                 refuse to bundle anything still tagged
 *                                 `unverified` into a production build.
 */

export const LICENSE_TAGS = [
  'public-domain',
  'factual',
  'permissive-with-credit',
  'kfgqpc-terms',
  'digitalkhatt-anane',
  'gpl-derivative',
  'per-translator',
  'per-reciter',
  'unverified',
] as const;

export type LicenseTag = (typeof LICENSE_TAGS)[number];

/** Set of license tags that are safe to bundle into closed-source binaries. */
export const BUNDLE_SAFE_LICENSES: ReadonlySet<LicenseTag> = new Set<LicenseTag>([
  'public-domain',
  'factual',
  'permissive-with-credit',
]);

export interface LicenseMetadata {
  readonly sourceId: string;
  /** Where the row was fetched from — typically a `qul.tarteel.ai/resources/...` URL. */
  readonly sourceUrl: string;
  readonly license: LicenseTag;
  readonly attributionRequired: boolean;
  /** Human-readable attribution string to show in Settings → Data Sources. */
  readonly attributionText: string;
}

/**
 * Returns true when a row may be bundled into the mobile binary or any
 * client-side asset. Service-side use (where the service itself is AGPL)
 * may permit broader licenses — check at the call site.
 */
export function isBundleSafe(license: LicenseTag): boolean {
  return BUNDLE_SAFE_LICENSES.has(license);
}

/** Composes a stable attribution line for a row. */
export function attributionLine(meta: LicenseMetadata): string {
  return meta.attributionRequired
    ? `${meta.attributionText} (via QUL: ${meta.sourceUrl})`
    : `via QUL: ${meta.sourceUrl}`;
}
