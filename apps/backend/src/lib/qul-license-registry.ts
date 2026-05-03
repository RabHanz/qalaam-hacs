/**
 * Single source of truth for QUL `LicenseMetadata` per resource.
 *
 * Per ADR-0020: every QUL surface attaches the right LicenseMetadata at
 * call time. Centralizing here means a license bump (e.g., a translator
 * removes commercial-use permission) is a one-line edit + a redeploy,
 * not a hunt across 14 route files.
 *
 * If a key is missing from the registry, the corresponding sub-reader
 * fails closed (per ADR-0020 risk mitigation).
 */
import type { LicenseMetadata, ScriptSlug } from '@qalaam/data-loader/qul';

const QUL_BASE = 'https://qul.tarteel.ai/resources';

export const LICENSE_METADATA = {
  quranMetadata: {
    sourceId: 'qul-quran-metadata-v1',
    sourceUrl: `${QUL_BASE}/quran-metadata`,
    license: 'factual',
    attributionRequired: true,
    attributionText: 'Quranic Universal Library (QUL) by Tarteel AI',
  } satisfies LicenseMetadata,

  mutashabihatV2: {
    sourceId: 'qul-mutashabihat-v2',
    sourceUrl: `${QUL_BASE}/mutashabihat`,
    license: 'permissive-with-credit',
    attributionRequired: true,
    attributionText: 'Quranic Universal Library (QUL) — community-curated mutashabihat',
  } satisfies LicenseMetadata,

  similarAyahs: {
    sourceId: 'qul-similar-ayah',
    sourceUrl: `${QUL_BASE}/similar-ayah`,
    license: 'permissive-with-credit',
    attributionRequired: true,
    attributionText: 'Quranic Universal Library (QUL) — community-curated similar-ayah pairs',
  } satisfies LicenseMetadata,

  wbwTranslationEn: {
    sourceId: 'qul-wbw-en-corpus',
    sourceUrl: `${QUL_BASE}/translation`,
    license: 'permissive-with-credit',
    attributionRequired: true,
    attributionText:
      'Quranic Universal Library (QUL) — Quranic Arabic Corpus word-by-word (English)',
  } satisfies LicenseMetadata,

  /**
   * Morphology is GPL-derivative (Kais Dukes' Quranic Arabic Corpus).
   * Backend can surface it (we're AGPL-licensed per ADR-0011) but the
   * mobile binary cannot bundle it. Routes that surface morphology must
   * gate by tier and document the license in the response.
   */
  morphology: {
    sourceId: 'qul-morphology',
    sourceUrl: `${QUL_BASE}/morphology`,
    license: 'gpl-derivative',
    attributionRequired: true,
    attributionText: 'Quranic Arabic Corpus by Dr. Kais Dukes (via QUL)',
  } satisfies LicenseMetadata,

  surahInfoEn: {
    sourceId: 'qul-surah-info-en',
    sourceUrl: `${QUL_BASE}/surah-info/3`,
    license: 'permissive-with-credit',
    attributionRequired: true,
    attributionText: 'Quranic Universal Library (QUL) — Surah info (English)',
  } satisfies LicenseMetadata,

  /** Per-language surah-info LicenseMetadata map. Add a row when a new language ships. */
  surahInfoByLanguage: new Map<string, LicenseMetadata>([
    [
      'en',
      {
        sourceId: 'qul-surah-info-en',
        sourceUrl: `${QUL_BASE}/surah-info/3`,
        license: 'permissive-with-credit',
        attributionRequired: true,
        attributionText: 'Quranic Universal Library (QUL) — Surah info (English)',
      },
    ],
  ]),

  /** Per-reciter LicenseMetadata map; add a row when a new reciter ships. */
  recitersByReciterId: new Map<string, LicenseMetadata>([
    [
      'husary',
      {
        sourceId: 'everyayah-husary',
        sourceUrl: 'https://everyayah.com/data/Husary_128kbps/',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Mahmoud Khalil Al-Husary (via EveryAyah, sourced through QUL)',
      },
    ],
    [
      'mishary-alafasy',
      {
        sourceId: 'everyayah-alafasy',
        sourceUrl: 'https://everyayah.com/data/Alafasy_128kbps/',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Mishary Rashid Alafasy (via EveryAyah, sourced through QUL)',
      },
    ],
    [
      'abdul-basit-abd-as-samad',
      {
        sourceId: 'everyayah-abdul-basit',
        sourceUrl: 'https://everyayah.com/data/Abdul_Basit_Murattal_64kbps/',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Abdul Basit Abd as-Samad — Murattal (via EveryAyah, sourced through QUL)',
      },
    ],
  ]),

  /** Per-script LicenseMetadata map. */
  scriptsBySlug: new Map<ScriptSlug, LicenseMetadata>([
    [
      'uthmani_simple',
      {
        sourceId: 'qul-script-uthmani-simple',
        sourceUrl: `${QUL_BASE}/quran-script`,
        license: 'permissive-with-credit',
        attributionRequired: true,
        attributionText: 'Quranic Universal Library (QUL) — Uthmani simple script',
      },
    ],
    [
      'indopak_nastaleeq',
      {
        sourceId: 'qul-script-indopak-nastaleeq',
        sourceUrl: `${QUL_BASE}/quran-script/59`,
        license: 'permissive-with-credit',
        attributionRequired: true,
        attributionText: 'Quranic Universal Library (QUL) — Indopak Nastaleeq word-by-word',
      },
    ],
    [
      'kfgqpc_hafs',
      {
        sourceId: 'qul-script-kfgqpc-hafs',
        sourceUrl: `${QUL_BASE}/quran-script`,
        license: 'kfgqpc-terms',
        attributionRequired: true,
        attributionText: 'King Fahd Glorious Quran Printing Complex',
      },
    ],
    [
      'kfgqpc_hafs_tajweed',
      {
        sourceId: 'qul-script-kfgqpc-hafs-tajweed',
        sourceUrl: `${QUL_BASE}/quran-script/47`,
        license: 'kfgqpc-terms',
        attributionRequired: true,
        attributionText: 'King Fahd Glorious Quran Printing Complex (with tajweed colors)',
      },
    ],
  ]),
} as const;
