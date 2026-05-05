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

    // Depth-pull batch (Apr 2026): 37 reciters mirrored via everyayah.com
    // CDN. Each is published by the reciter (or their estate/printing house)
    // for free non-commercial distribution; everyayah.com is the canonical
    // mirror used by Tarteel, Quran.com, and most open clients. Attribution
    // is per-reciter; if a reciter or rights-holder requests removal we drop
    // the license entry and the route fails closed.
    ...(
      [
        ['abdullah-basfar', 'Abdullah Basfar'],
        ['abdullah-juhaynee', 'Abdullah Awad al-Juhaynee'],
        ['abu-bakr-shatri-64', 'Abu Bakr al-Shatri (64kbps)'],
        ['ahmed-al-ajami', 'Ahmed ibn Ali al-Ajami'],
        ['ahmed-neana', 'Ahmed Neana'],
        ['akram-al-alaqimy', 'Akram al-ʿAlaqimy'],
        ['alafasy-64', 'Mishary Rashid al-Afasy (64kbps)'],
        ['ali-al-hudhaify', 'ʿAli ibn Abdur Rahman al-Hudhaify'],
        ['ali-hajjaj-suesy', 'Ali Hajjaj al-Suesy'],
        ['ali-jaber', 'ʿAli Jaber'],
        ['ayman-sowaid', 'Ayman Sowaid'],
        ['fares-abbad', 'Fares Abbad'],
        ['ghamadi-40', 'Saʿd al-Ghamdi (40kbps)'],
        ['hani-rifai-64', 'Hani al-Rifai (64kbps)'],
        ['hudhaify-32', 'ʿAli al-Hudhaify (32kbps)'],
        ['husary-128', 'Mahmoud Khalil al-Husary (128kbps)'],
        ['husary-64', 'Mahmoud Khalil al-Husary (64kbps)'],
        ['husary-mujawwad-128', 'al-Husary (Mujawwad, 128kbps)'],
        ['ibrahim-al-akhdar', 'Ibrāhīm al-Akhdar'],
        ['ibrahim-al-akhdar-64', 'Ibrāhīm al-Akhdar (64kbps)'],
        ['karim-mansoori', 'Karim Mansoori'],
        ['khalid-al-qahtani', 'Khalid al-Qahtani'],
        ['maher-muaiqly-128', 'Maher al-Muaiqly (128kbps)'],
        ['maher-muaiqly-64', 'Maher al-Muaiqly (64kbps)'],
        ['mohammad-al-tablaway', 'Muhammad al-Tablaway'],
        ['mohammad-tablaway-64', 'Muhammad al-Tablaway (64kbps)'],
        ['muhammad-ayyoub', 'Muhammad Ayyoub'],
        ['muhammad-jibreel', 'Muhammad Jibreel'],
        ['muhsin-al-qasim', 'Muhsin al-Qasim'],
        ['mustafa-ismail', 'Mustafa Ismail'],
        ['nasser-al-qatami', 'Nasser al-Qatami'],
        ['sahl-yasin', 'Sahl Yasin'],
        ['salah-al-budair', 'Salah al-Budair'],
        ['salah-bukhatir', 'Salah al-Bukhatir'],
        ['saood-shuraym-64', 'Saʿūd al-Shuraym (64kbps)'],
        ['yaser-salamah', 'Yaser Salamah'],
        ['yasser-dussary-128', 'Yasser al-Dussary (128kbps)'],
      ] as const
    ).map(
      ([id, displayName]) =>
        [
          id,
          {
            sourceId: `everyayah-${id}`,
            sourceUrl: 'https://everyayah.com',
            license: 'per-reciter',
            attributionRequired: true,
            attributionText: `${displayName} — via everyayah.com (free non-commercial distribution)`,
          } satisfies LicenseMetadata,
        ] as const,
    ),
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
