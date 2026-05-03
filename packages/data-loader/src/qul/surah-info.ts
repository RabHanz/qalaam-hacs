/**
 * Surah-info loader (QUL `/resources/surah-info`, 9 languages observed:
 * Tamil, Urdu, Indonesian, English, Italian, Malayalam + 3 unenumerated).
 *
 * Powers the deep-study pane "context card" — revelation place + period +
 * key themes + summary — that v0.1 lacks. Per ADR-0020. Schema:
 * `qalaam_v1_qul_surah_info`.
 *
 * License: typically `permissive-with-credit` (community-curated text).
 * Per-language `LicenseMetadata` is attached at construction so the
 * caller knows which translator to credit.
 */
import type { LicenseMetadata } from './license.js';
import type { Database as DB, Statement } from 'better-sqlite3';

export interface SurahInfoCard {
  readonly surah: number;
  readonly languageCode: string; // ISO 639-1
  readonly nameArabic: string;
  readonly nameTranslated: string;
  readonly nameMeaning: string | null;
  readonly revelationPlace: 'makkah' | 'madinah';
  readonly revelationOrder: number | null;
  readonly verseCount: number;
  readonly summary: string;
  /** Themes / key topics (curated list). */
  readonly themes: readonly string[];
  /** Optional asbab-al-nuzul (occasions of revelation) — when present. */
  readonly asbabAlNuzul: string | null;
  readonly meta: LicenseMetadata;
}

export interface SurahInfoReader {
  /** All surah info cards for a given language, in surah order. */
  forLanguage(languageCode: string): readonly SurahInfoCard[];
  card(surah: number, languageCode: string): SurahInfoCard | undefined;
  /** Languages this dataset has cards for. */
  availableLanguages(): readonly string[];
}

interface RawCard {
  surah: number;
  language_code: string;
  name_arabic: string;
  name_translated: string;
  name_meaning: string | null;
  revelation_place: 'makkah' | 'madinah';
  revelation_order: number | null;
  verse_count: number;
  summary: string;
  themes_json: string;
  asbab_al_nuzul: string | null;
}

export function buildSurahInfoReader(
  db: DB,
  metaPerLanguage: ReadonlyMap<string, LicenseMetadata>,
): SurahInfoReader {
  const stmt = {
    forLanguage: db.prepare<[string], RawCard>(
      `SELECT surah, language_code, name_arabic, name_translated, name_meaning,
              revelation_place, revelation_order, verse_count, summary,
              themes_json, asbab_al_nuzul
       FROM qalaam_v1_qul_surah_info
       WHERE language_code = ?
       ORDER BY surah ASC`,
    ),
    card: db.prepare<[number, string], RawCard>(
      `SELECT surah, language_code, name_arabic, name_translated, name_meaning,
              revelation_place, revelation_order, verse_count, summary,
              themes_json, asbab_al_nuzul
       FROM qalaam_v1_qul_surah_info
       WHERE surah = ? AND language_code = ?`,
    ),
    languages: db.prepare<[], { language_code: string }>(
      `SELECT DISTINCT language_code FROM qalaam_v1_qul_surah_info ORDER BY language_code ASC`,
    ),
  } satisfies Record<string, Statement>;

  function decode(r: RawCard): SurahInfoCard {
    const lic = metaPerLanguage.get(r.language_code);
    if (!lic) {
      throw new Error(
        `qalaam.qul.unlicensed-language: surah-info for ${r.language_code} ` +
          `has no LicenseMetadata. Refusing to surface — see ADR-0020.`,
      );
    }
    return {
      surah: r.surah,
      languageCode: r.language_code,
      nameArabic: r.name_arabic,
      nameTranslated: r.name_translated,
      nameMeaning: r.name_meaning,
      revelationPlace: r.revelation_place,
      revelationOrder: r.revelation_order,
      verseCount: r.verse_count,
      summary: r.summary,
      themes: JSON.parse(r.themes_json) as string[],
      asbabAlNuzul: r.asbab_al_nuzul,
      meta: lic,
    };
  }

  return {
    forLanguage(languageCode) {
      return stmt.forLanguage.all(languageCode).map(decode);
    },
    card(surah, languageCode) {
      const r = stmt.card.get(surah, languageCode);
      return r ? decode(r) : undefined;
    },
    availableLanguages() {
      return stmt.languages.all().map((r) => r.language_code);
    },
  };
}
