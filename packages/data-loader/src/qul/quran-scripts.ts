/**
 * Quran-scripts loader (QUL `/resources/quran-script`, 28 scripts observed).
 *
 * Extends the v0.1 Uthmani-only support to:
 *   - Indopak Nastaleeq word-by-word (id 59) — required for non-Arab
 *     subcontinental users (a core Qalaam ICP).
 *   - KFGQPC V4 with tajweed (id 47, V4 Glyphs Tajweed wbw) — for Hifdh
 *     users on KFGQPC mushaf with tajweed-color overlay.
 *   - DigitalKhatt v1/v2 wbw — for users who prefer Anane's modern script.
 *   - Per-script per-word position data so a renderer can lay glyphs to
 *     match the printed page layout exactly.
 *
 * Per ADR-0020. Schema: `qalaam_v1_qul_scripts_*`.
 *
 * **License:** per-script. KFGQPC scripts are `kfgqpc-terms` (require
 * "King Fahd Glorious Quran Printing Complex" attribution); DigitalKhatt
 * is `digitalkhatt-anane` (Anane attribution); Uthmani / Imlaei / Indopak
 * are `permissive-with-credit`. The caller passes a `scriptSlug →
 * LicenseMetadata` map; reader refuses unlicensed scripts (fail-closed).
 */
import type { LicenseMetadata } from './license.js';
import type { Database as DB, Statement } from 'better-sqlite3';

export type ScriptSlug =
  | 'uthmani_simple'
  | 'uthmani_full'
  | 'imlaei_simple'
  | 'kfgqpc_hafs'
  | 'kfgqpc_hafs_tajweed'
  | 'qpc_nastaleeq'
  | 'indopak_nastaleeq'
  | 'pdms_saleem'
  | 'digitalkhatt_v1'
  | 'digitalkhatt_v2'
  | 'v1_glyphs'
  | 'v2_glyphs'
  | 'v4_glyphs'
  | 'v4_glyphs_tajweed';

export interface ScriptAyah {
  readonly verseKey: string;
  readonly script: ScriptSlug;
  readonly text: string;
  readonly meta: LicenseMetadata;
}

export interface ScriptWord {
  readonly verseKey: string;
  readonly script: ScriptSlug;
  readonly wordIndex: number;
  readonly text: string;
  /** Optional bounding box in the layout (x, y, width, height) when available. */
  readonly bbox: { x: number; y: number; w: number; h: number } | null;
}

export interface QuranScriptsReader {
  ayah(script: ScriptSlug, verseKey: string): ScriptAyah | undefined;
  wordsForAyah(script: ScriptSlug, verseKey: string): readonly ScriptWord[];
  /** Slugs available in this dataset that the caller has licenses for. */
  availableScripts(): readonly ScriptSlug[];
}

interface RawAyah {
  verse_key: string;
  text: string;
}

interface RawWord {
  verse_key: string;
  word_index: number;
  text: string;
  bbox_json: string | null;
}

export function buildQuranScriptsReader(
  db: DB,
  scriptLicenses: ReadonlyMap<ScriptSlug, LicenseMetadata>,
): QuranScriptsReader {
  const stmt = {
    ayah: db.prepare<[string, string], RawAyah>(
      `SELECT verse_key, text
       FROM qalaam_v1_qul_scripts_ayahs
       WHERE script = ? AND verse_key = ?`,
    ),
    words: db.prepare<[string, string], RawWord>(
      `SELECT verse_key, word_index, text, bbox_json
       FROM qalaam_v1_qul_scripts_words
       WHERE script = ? AND verse_key = ?
       ORDER BY word_index ASC`,
    ),
  } satisfies Record<string, Statement>;

  function ensureLicensed(script: ScriptSlug): LicenseMetadata {
    const lic = scriptLicenses.get(script);
    if (!lic) {
      throw new Error(
        `qalaam.qul.unlicensed-script: ${script} not in scriptLicenses map. ` +
          `Refusing to surface — see ADR-0020.`,
      );
    }
    return lic;
  }

  return {
    ayah(script, verseKey) {
      const lic = ensureLicensed(script);
      const r = stmt.ayah.get(script, verseKey);
      if (!r) return undefined;
      return { verseKey: r.verse_key, script, text: r.text, meta: lic };
    },
    wordsForAyah(script, verseKey) {
      ensureLicensed(script);
      return stmt.words.all(script, verseKey).map((r) => ({
        verseKey: r.verse_key,
        script,
        wordIndex: r.word_index,
        text: r.text,
        bbox: r.bbox_json
          ? (JSON.parse(r.bbox_json) as { x: number; y: number; w: number; h: number })
          : null,
      }));
    },
    availableScripts() {
      return Array.from(scriptLicenses.keys());
    },
  };
}
