/**
 * Recitation-segments loader (QUL `/resources/recitation`, segmented subset).
 *
 * QUL ships 62 reciters with word-level start/end timestamps per ayah.
 * This is what powers:
 *   - Word highlighting that follows the audio (O-13).
 *   - Pause-and-prompt drills in `services/realtime-feedback` (O-06).
 *   - Sentence-level repetition without re-buffering audio.
 *
 * Per ADR-0020. Schema: `qalaam_v1_qul_recitations_*`.
 *
 * **License:** every reciter row carries its own `per-reciter` LicenseMetadata.
 * The caller passes a `reciterId → LicenseMetadata` map and the reader refuses
 * to surface segments for any reciter not in the map (fail-closed). Cross-check
 * paid-tier shipping against `reference_2026_ai_stack.md` per-reciter playbook.
 */
import type { LicenseMetadata } from './license.js';
import type { Database as DB, Statement } from 'better-sqlite3';

export interface ReciterInfo {
  readonly reciterId: string;
  /** Display name in Arabic + English. */
  readonly name: { ar: string; en: string };
  /** "murattal" | "mujawwad" | "muallim" — recitation style. */
  readonly style: 'murattal' | 'mujawwad' | 'muallim';
  /** "hafs" | "warsh" | "qalun" — qira'ah / riwayah. */
  readonly riwayah: string;
  /** Total ayahs with segment data (114 × ayahCount when complete). */
  readonly segmentCoverage: number;
  readonly meta: LicenseMetadata;
}

export interface WordSegment {
  readonly verseKey: string;
  readonly reciterId: string;
  readonly wordIndex: number;
  readonly startMs: number;
  readonly endMs: number;
}

export interface RecitationSegmentsReader {
  /** All licensed reciters (those in the `reciterLicenses` map at construction). */
  reciters(): readonly ReciterInfo[];
  reciter(reciterId: string): ReciterInfo | undefined;
  /** Word-level timings for an ayah, in ascending word-index. */
  segmentsForAyah(reciterId: string, verseKey: string): readonly WordSegment[];
  /**
   * Returns the word index whose [start_ms, end_ms] interval contains
   * `positionMs`. Used by the player to know which word to highlight.
   */
  wordAtPosition(reciterId: string, verseKey: string, positionMs: number): number | undefined;
}

interface RawReciter {
  reciter_id: string;
  name_arabic: string;
  name_english: string;
  style: ReciterInfo['style'];
  riwayah: string;
  segment_coverage: number;
}

interface RawSegment {
  verse_key: string;
  word_index: number;
  start_ms: number;
  end_ms: number;
}

export class UnlicensedReciterError extends Error {
  public constructor(public readonly reciterId: string) {
    super(
      `Reciter ${reciterId} is not present in reciterLicenses; ` +
        `segments cannot be surfaced. Add it to the licenses map or remove from the catalog.`,
    );
  }
}

export function buildRecitationSegmentsReader(
  db: DB,
  reciterLicenses: ReadonlyMap<string, LicenseMetadata>,
): RecitationSegmentsReader {
  const stmt = {
    listReciters: db.prepare<[], RawReciter>(
      `SELECT reciter_id, name_arabic, name_english, style, riwayah, segment_coverage
       FROM qalaam_v1_qul_recitations_reciters
       ORDER BY name_english ASC`,
    ),
    getReciter: db.prepare<[string], RawReciter>(
      `SELECT reciter_id, name_arabic, name_english, style, riwayah, segment_coverage
       FROM qalaam_v1_qul_recitations_reciters
       WHERE reciter_id = ?`,
    ),
    segments: db.prepare<[string, string], RawSegment>(
      `SELECT verse_key, word_index, start_ms, end_ms
       FROM qalaam_v1_qul_recitations_segments
       WHERE reciter_id = ? AND verse_key = ?
       ORDER BY word_index ASC`,
    ),
    wordAt: db.prepare<[string, string, number, number], { word_index: number }>(
      `SELECT word_index FROM qalaam_v1_qul_recitations_segments
       WHERE reciter_id = ? AND verse_key = ? AND start_ms <= ? AND end_ms >= ?
       ORDER BY word_index ASC LIMIT 1`,
    ),
  } satisfies Record<string, Statement>;

  function ensureLicensed(reciterId: string): LicenseMetadata {
    const lic = reciterLicenses.get(reciterId);
    if (!lic) {
      throw new Error(
        `qalaam.qul.unlicensed-reciter: ${reciterId} not in reciterLicenses map. ` +
          `Refusing to surface segments — see ADR-0020.`,
      );
    }
    return lic;
  }

  return {
    reciters() {
      return stmt.listReciters.all().flatMap((r) => {
        const lic = reciterLicenses.get(r.reciter_id);
        if (!lic) return [];
        return [
          {
            reciterId: r.reciter_id,
            name: { ar: r.name_arabic, en: r.name_english },
            style: r.style,
            riwayah: r.riwayah,
            segmentCoverage: r.segment_coverage,
            meta: lic,
          },
        ];
      });
    },
    reciter(reciterId) {
      const lic = reciterLicenses.get(reciterId);
      if (!lic) return undefined;
      const r = stmt.getReciter.get(reciterId);
      if (!r) return undefined;
      return {
        reciterId: r.reciter_id,
        name: { ar: r.name_arabic, en: r.name_english },
        style: r.style,
        riwayah: r.riwayah,
        segmentCoverage: r.segment_coverage,
        meta: lic,
      };
    },
    segmentsForAyah(reciterId, verseKey) {
      ensureLicensed(reciterId);
      return stmt.segments.all(reciterId, verseKey).map(
        (r): WordSegment => ({
          verseKey: r.verse_key,
          reciterId,
          wordIndex: r.word_index,
          startMs: r.start_ms,
          endMs: r.end_ms,
        }),
      );
    },
    wordAtPosition(reciterId, verseKey, positionMs) {
      ensureLicensed(reciterId);
      return stmt.wordAt.get(reciterId, verseKey, positionMs, positionMs)?.word_index;
    },
  };
}
