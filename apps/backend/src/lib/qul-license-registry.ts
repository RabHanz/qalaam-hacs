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

  /**
   * Per-reciter LicenseMetadata map; add a row when a new reciter ships.
   * Slugs match `qalaam_v1_qul_recitations_reciters.reciter_id`. Each entry
   * records the upstream QUL resource so a license bump is a one-line edit.
   */
  recitersByReciterId: new Map<string, LicenseMetadata>([
    [
      'husary',
      {
        sourceId: 'qul-recitation-110',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/110',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Mahmoud Khalil Al-Husary (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'husary-mujawwad',
      {
        sourceId: 'qul-recitation-111',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/111',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Mahmoud Khalil Al-Husary (Mujawwad/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'mishary-alafasy',
      {
        sourceId: 'qul-recitation-118',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/118',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Mishary Rashid Al-Afasy (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'sudais',
      {
        sourceId: 'qul-recitation-102',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/102',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Abdul Rahman Al-Sudais (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'maher-muaiqly',
      {
        sourceId: 'qul-recitation-113',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/113',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Maher Al-Muaiqly (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'minshawi',
      {
        sourceId: 'qul-recitation-108',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/108',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Muhammad Siddiq Al-Minshawi (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'abu-bakr-shatri',
      {
        sourceId: 'qul-recitation-117',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/117',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Abu Bakr Al-Shatri (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'saad-al-ghamdi',
      {
        sourceId: 'qul-recitation-119',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/119',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Saad Al-Ghamdi (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'abdul-basit-murattal',
      {
        sourceId: 'qul-recitation-115',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/115',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Abdul Basit Abd as-Samad (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'abdul-basit-mujawwad',
      {
        sourceId: 'qul-recitation-114',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/114',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Abdul Basit Abd as-Samad (Mujawwad/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'yasser-aldosari',
      {
        sourceId: 'qul-recitation-103',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/103',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Yasser Al-Dosari (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'saud-shuraim',
      {
        sourceId: 'qul-recitation-107',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/107',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Saud Al-Shuraim (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'hani-rifai',
      {
        sourceId: 'qul-recitation-104',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/104',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Hani Al-Rifai (Murattal/Hafs) — via QUL by Tarteel AI',
      },
    ],
    [
      'khalifa-al-tunaiji',
      {
        sourceId: 'qul-recitation-109',
        sourceUrl: 'https://qul.tarteel.ai/resources/recitation/109',
        license: 'per-reciter',
        attributionRequired: true,
        attributionText: 'Khalifa Al-Tunaiji (Murattal/Hafs) — via QUL by Tarteel AI',
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
