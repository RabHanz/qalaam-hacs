/**
 * Quran-metadata loader (QUL resource IDs 63..70).
 *
 * Resources covered (per Docs/research/qul-inventory.md §1 row 7):
 *   63 — Surah names (chapter index, names by language, ayah count, place of
 *        revelation)
 *   64 — Sajda ayahs (the 15 prostration verses)
 *   65 — Ayah index (juz/hizb/rub/page per ayah — denormalized lookup)
 *   66 — Juz boundaries (start/end ayah per juz)
 *   67 — Hizb boundaries (start/end ayah per hizb — 60 entries)
 *   68 — Rub el Hizb (240 quarter-hizb markers)
 *   69 — Manzil (7 weekly recitation divisions)
 *   70 — Ruku (557 thematic paragraphs — used for Hifdh portion-splits when
 *        page-based splits aren't desired)
 *
 * License: `factual` per `license.ts` — verse boundaries are facts, not
 * authored content. Attribution to QUL preserved anyway.
 *
 * **Why this is the first deep loader:** smallest payload, license-clean,
 * unblocks the Hifdh portion engine to use proper boundaries (ruku/hizb/manzil)
 * instead of approximating with juz only. See ADR-0020 §Decision.
 */

import type { Database as DB, Statement } from 'better-sqlite3';

import type { LicenseMetadata } from './license.js';

export interface SurahInfo {
  readonly surah: number;
  readonly nameArabic: string;
  readonly nameTransliteration: string;
  readonly nameEnglish: string;
  readonly verseCount: number;
  readonly revelationPlace: 'makkah' | 'madinah';
  readonly revelationOrder: number;
  readonly bismillahPre: boolean;
}

export interface JuzBoundary {
  readonly juz: number;
  readonly firstVerseKey: string;
  readonly lastVerseKey: string;
  readonly verseCount: number;
}

export interface HizbBoundary {
  readonly hizb: number;
  readonly juz: number;
  readonly firstVerseKey: string;
  readonly lastVerseKey: string;
}

export interface RubBoundary {
  readonly rub: number;
  readonly hizb: number;
  readonly firstVerseKey: string;
}

export interface ManzilBoundary {
  readonly manzil: number;
  readonly firstVerseKey: string;
  readonly lastVerseKey: string;
}

export interface RukuBoundary {
  readonly ruku: number;
  readonly surah: number;
  readonly firstVerseKey: string;
  readonly lastVerseKey: string;
}

export interface SajdaAyah {
  readonly verseKey: string;
  /** Recommended (مستحب) vs obligatory (واجب) per the four major madhahib. */
  readonly type: 'recommended' | 'obligatory';
}

export interface QuranMetadataReader {
  readonly meta: LicenseMetadata;
  surahInfo(surah: number): SurahInfo | undefined;
  allSurahs(): readonly SurahInfo[];
  juzBoundary(juz: number): JuzBoundary | undefined;
  hizbBoundary(hizb: number): HizbBoundary | undefined;
  rubBoundary(rub: number): RubBoundary | undefined;
  manzilBoundary(manzil: number): ManzilBoundary | undefined;
  rukuBoundary(ruku: number): RukuBoundary | undefined;
  rukusInSurah(surah: number): readonly RukuBoundary[];
  sajdaAyahs(): readonly SajdaAyah[];
}

/**
 * Build a `QuranMetadataReader` over an opened better-sqlite3 DB containing
 * the QUL metadata tables. The schema name is `qalaam_v1_qul_metadata_*`
 * (mirrors the `qalaam_v1_*` view convention from `index.ts`) so a QUL bump
 * can be absorbed via migrations without rippling through consumers.
 */
export function buildQuranMetadataReader(
  db: DB,
  meta: LicenseMetadata,
): QuranMetadataReader {
  const stmt = {
    surahOne: db.prepare<[number], SurahInfo>(
      `SELECT surah, name_arabic AS nameArabic, name_transliteration AS nameTransliteration,
              name_english AS nameEnglish, verse_count AS verseCount,
              revelation_place AS revelationPlace, revelation_order AS revelationOrder,
              bismillah_pre AS bismillahPre
       FROM qalaam_v1_qul_metadata_surahs
       WHERE surah = ?`,
    ),
    surahsAll: db.prepare<[], SurahInfo>(
      `SELECT surah, name_arabic AS nameArabic, name_transliteration AS nameTransliteration,
              name_english AS nameEnglish, verse_count AS verseCount,
              revelation_place AS revelationPlace, revelation_order AS revelationOrder,
              bismillah_pre AS bismillahPre
       FROM qalaam_v1_qul_metadata_surahs
       ORDER BY surah ASC`,
    ),
    juz: db.prepare<[number], JuzBoundary>(
      `SELECT juz, first_verse_key AS firstVerseKey, last_verse_key AS lastVerseKey,
              verse_count AS verseCount
       FROM qalaam_v1_qul_metadata_juz
       WHERE juz = ?`,
    ),
    hizb: db.prepare<[number], HizbBoundary>(
      `SELECT hizb, juz, first_verse_key AS firstVerseKey, last_verse_key AS lastVerseKey
       FROM qalaam_v1_qul_metadata_hizb
       WHERE hizb = ?`,
    ),
    rub: db.prepare<[number], RubBoundary>(
      `SELECT rub, hizb, first_verse_key AS firstVerseKey
       FROM qalaam_v1_qul_metadata_rub
       WHERE rub = ?`,
    ),
    manzil: db.prepare<[number], ManzilBoundary>(
      `SELECT manzil, first_verse_key AS firstVerseKey, last_verse_key AS lastVerseKey
       FROM qalaam_v1_qul_metadata_manzil
       WHERE manzil = ?`,
    ),
    rukuOne: db.prepare<[number], RukuBoundary>(
      `SELECT ruku, surah, first_verse_key AS firstVerseKey, last_verse_key AS lastVerseKey
       FROM qalaam_v1_qul_metadata_ruku
       WHERE ruku = ?`,
    ),
    rukuBySurah: db.prepare<[number], RukuBoundary>(
      `SELECT ruku, surah, first_verse_key AS firstVerseKey, last_verse_key AS lastVerseKey
       FROM qalaam_v1_qul_metadata_ruku
       WHERE surah = ?
       ORDER BY ruku ASC`,
    ),
    sajdaAll: db.prepare<[], SajdaAyah>(
      `SELECT verse_key AS verseKey, type
       FROM qalaam_v1_qul_metadata_sajda
       ORDER BY verse_key ASC`,
    ),
  } satisfies Record<string, Statement<unknown[], unknown>>;

  return {
    meta,
    surahInfo(surah) {
      return stmt.surahOne.get(surah);
    },
    allSurahs() {
      return stmt.surahsAll.all();
    },
    juzBoundary(juz) {
      return stmt.juz.get(juz);
    },
    hizbBoundary(hizb) {
      return stmt.hizb.get(hizb);
    },
    rubBoundary(rub) {
      return stmt.rub.get(rub);
    },
    manzilBoundary(manzil) {
      return stmt.manzil.get(manzil);
    },
    rukuBoundary(ruku) {
      return stmt.rukuOne.get(ruku);
    },
    rukusInSurah(surah) {
      return stmt.rukuBySurah.all(surah);
    },
    sajdaAyahs() {
      return stmt.sajdaAll.all();
    },
  };
}
