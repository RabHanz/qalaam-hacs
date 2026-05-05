/**
 * Server-side word-level forced aligner for unsegmented reciters.
 *
 * Most QUL-licensed reciters ship pre-computed word timings in
 * `qalaam_v1_qul_recitations_segments`. The 37 reciters we mirror via
 * EveryAyah do NOT — they're audio-only. To unlock the same
 * Tarteel-style word-by-word highlight UX for them, we generate
 * segments on demand and cache the result so the next user hits the DB.
 *
 * Strategy (Phase 1 — char-weighted heuristic):
 *
 *   1. Probe the audio file's byte length + extract its bitrate from
 *      the first MP3 frame header. duration_ms ≈
 *      (size - id3_offset) / (bitrate / 8). Accurate to <1% on CBR
 *      MP3, which is the EveryAyah catalog's format.
 *   2. Tokenize the verse's Uthmani text by whitespace; weight each
 *      token by its rendered character length (`Array.from(s).length`
 *      to count grapheme-ish units, since Arabic combining marks
 *      otherwise distort the proportion).
 *   3. Apportion the duration across tokens proportional to weight,
 *      with a small `LEAD_IN_MS` (250ms) to skip the start-of-recitation
 *      bismillah breath, and `TAIL_PAUSE_MS` (300ms) reserved for the
 *      closing madd / qalqalah on the LAST word so it has natural
 *      breathing room.
 *
 * Phase 2 (future, offline batch): proper acoustic forced-alignment via
 * aeneas / WhisperX. The interface here doesn't change — the route
 * just sees richer segment data when it's been pre-computed.
 *
 * Caching: `qalaam_v1_recitations_segments_aligned` (created on first
 * use) holds the heuristic output keyed by (reciter_id, verse_key).
 * The route layer falls through QUL → aligned, returning whichever
 * has data. Manual invalidation: `DELETE FROM ...` and re-call.
 *
 * License posture: this never sends audio to a third-party service;
 * we only make a Range request to the upstream CDN to read the first
 * ~64 bytes (MP3 frame header parsing). Per ADR-0005 + ADR-0020.
 */
import Database from 'better-sqlite3';

import type { Database as DB } from 'better-sqlite3';

export interface AlignedSegment {
  readonly verseKey: string;
  readonly reciterId: string;
  readonly wordIndex: number; // 1-indexed to match QUL's segment shape
  readonly startMs: number;
  readonly endMs: number;
}

const LEAD_IN_MS = 250;
const TAIL_PAUSE_MS = 300;
// Cap a single word's allocated duration to avoid runaway estimates on
// e.g. a 1-token surah (we'd otherwise hand the entire audio to the
// rosette glyph). Most words are 200ms-1500ms in actual recitation.
const MAX_WORD_MS = 4_000;
const MIN_WORD_MS = 120;

// Common MP3 bitrate index (from the MPEG-1 Layer III spec, ISO 11172-3).
// Layer III, MPEG-1 only — sufficient for everyayah catalog.
const MP3_BITRATE_KBPS_LAYER3_MPEG1: readonly (number | null)[] = [
  null,
  32,
  40,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  160,
  192,
  224,
  256,
  320,
  null,
];
const MP3_BITRATE_KBPS_LAYER3_MPEG2: readonly (number | null)[] = [
  null,
  8,
  16,
  24,
  32,
  40,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  144,
  160,
  null,
];

/**
 * Probe an MP3 URL for duration. We Range-request the first 4KB to
 * skip ID3v2 + locate the first MPEG audio frame, parse its header
 * for bitrate, then derive duration from Content-Length. If anything
 * fails we return null and the caller falls back gracefully.
 */
export async function probeMp3DurationMs(audioUrl: string): Promise<number | null> {
  let totalBytes: number | null = null;
  let head: ArrayBuffer | null = null;
  try {
    const headRes = await fetch(audioUrl, { method: 'HEAD' });
    if (!headRes.ok) return null;
    const cl = headRes.headers.get('content-length');
    if (cl) totalBytes = Number.parseInt(cl, 10);
    const rangeRes = await fetch(audioUrl, { headers: { Range: 'bytes=0-4095' } });
    if (!rangeRes.ok) return null;
    head = await rangeRes.arrayBuffer();
  } catch {
    return null;
  }
  if (totalBytes === null || head.byteLength < 16) return null;
  const bytes = new Uint8Array(head);
  const at = (i: number): number => bytes[i] ?? 0;

  // Skip ID3v2 if present. ID3v2 header is 10 bytes; size is the next
  // 4 bytes (sync-safe, 7 bits per byte).
  let offset = 0;
  if (bytes.length > 10 && at(0) === 0x49 && at(1) === 0x44 && at(2) === 0x33) {
    const tagSize =
      ((at(6) & 0x7f) << 21) | ((at(7) & 0x7f) << 14) | ((at(8) & 0x7f) << 7) | (at(9) & 0x7f);
    offset = 10 + tagSize;
  }
  // Find the first MP3 frame sync word (0xFFE).
  let sync = -1;
  for (let i = offset; i < bytes.length - 1; i += 1) {
    if (at(i) === 0xff && (at(i + 1) & 0xe0) === 0xe0) {
      sync = i;
      break;
    }
  }
  if (sync < 0 || sync + 4 > bytes.length) return null;
  const b1 = at(sync + 1);
  const b2 = at(sync + 2);
  const versionId = (b1 >> 3) & 0x03; // 11=MPEG1, 10=MPEG2, 00=MPEG2.5
  const layer = (b1 >> 1) & 0x03; // 01=Layer III
  if (layer !== 0x01) return null;
  const bitrateIdx = (b2 >> 4) & 0x0f;
  const table = versionId === 0x03 ? MP3_BITRATE_KBPS_LAYER3_MPEG1 : MP3_BITRATE_KBPS_LAYER3_MPEG2;
  const kbps = table[bitrateIdx];
  if (!kbps) return null;
  const audioBytes = totalBytes - offset;
  // duration_s = audioBytes / (kbps * 1000 / 8) = audioBytes * 8 / (kbps*1000)
  const durationMs = Math.round((audioBytes * 8 * 1000) / (kbps * 1000));
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  return durationMs;
}

/**
 * Apportion a duration across word tokens by character weight. Returns
 * 1-indexed segments to match QUL's shape exactly.
 */
export function alignByCharWeight(
  reciterId: string,
  verseKey: string,
  verseText: string,
  durationMs: number,
): readonly AlignedSegment[] {
  const tokens = verseText.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0 || durationMs <= 0) return [];
  const weights = tokens.map((t) => Array.from(t).length);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  // Available recitation window after lead-in + tail.
  const tail = Math.min(TAIL_PAUSE_MS, Math.floor(durationMs * 0.15));
  const lead = Math.min(LEAD_IN_MS, Math.floor(durationMs * 0.1));
  const window = Math.max(durationMs - lead - tail, durationMs * 0.5);

  const segments: AlignedSegment[] = [];
  let cursor = lead;
  for (let i = 0; i < tokens.length; i += 1) {
    const weight = weights[i] ?? 1;
    const raw = (window * weight) / Math.max(totalWeight, 1);
    let span = Math.max(MIN_WORD_MS, Math.min(MAX_WORD_MS, Math.round(raw)));
    // Last token gets the rest of the window (so endMs of last seg lines
    // up cleanly with durationMs - tail, eliminating a sub-frame leftover).
    const isLast = i === tokens.length - 1;
    if (isLast) span = Math.max(MIN_WORD_MS, durationMs - tail - cursor);
    const startMs = cursor;
    const endMs = cursor + span;
    segments.push({
      reciterId,
      verseKey,
      wordIndex: i + 1,
      startMs,
      endMs,
    });
    cursor = endMs + 10; // 10ms inter-word gap so [start,end] never overlap
  }
  return segments;
}

const ALIGNED_TABLE = 'qalaam_v1_recitations_segments_aligned';

export function ensureAlignedTable(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${ALIGNED_TABLE} (
      reciter_id  TEXT NOT NULL,
      verse_key   TEXT NOT NULL,
      word_index  INTEGER NOT NULL,
      start_ms    INTEGER NOT NULL,
      end_ms      INTEGER NOT NULL,
      source      TEXT NOT NULL DEFAULT 'char-weight',
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (reciter_id, verse_key, word_index)
    );
    CREATE INDEX IF NOT EXISTS idx_aligned_verse
      ON ${ALIGNED_TABLE}(reciter_id, verse_key);
  `);
}

export function getCachedAligned(
  dbPath: string,
  reciterId: string,
  verseKey: string,
): readonly AlignedSegment[] {
  const db = openReadonly(dbPath);
  if (!db) return [];
  try {
    ensureAlignedTableReadCheck(db);
    const rows = db
      .prepare<[string, string], { word_index: number; start_ms: number; end_ms: number }>(
        `SELECT word_index, start_ms, end_ms FROM ${ALIGNED_TABLE}
         WHERE reciter_id = ? AND verse_key = ?
         ORDER BY word_index`,
      )
      .all(reciterId, verseKey);
    return rows.map((r) => ({
      reciterId,
      verseKey,
      wordIndex: r.word_index,
      startMs: r.start_ms,
      endMs: r.end_ms,
    }));
  } catch {
    return [];
  }
}

export function persistAligned(dbPath: string, segments: readonly AlignedSegment[]): void {
  if (segments.length === 0) return;
  const db = openWritable(dbPath);
  if (!db) return;
  try {
    ensureAlignedTable(db);
    const insert = db.prepare(
      `INSERT OR REPLACE INTO ${ALIGNED_TABLE}
        (reciter_id, verse_key, word_index, start_ms, end_ms)
        VALUES (?,?,?,?,?)`,
    );
    const tx = db.transaction((rows: readonly AlignedSegment[]) => {
      for (const r of rows) {
        insert.run(r.reciterId, r.verseKey, r.wordIndex, r.startMs, r.endMs);
      }
    });
    tx(segments);
  } catch {
    /* swallow — caching is best-effort */
  }
}

function openReadonly(path: string): DB | null {
  try {
    return new Database(path, { readonly: true, fileMustExist: true });
  } catch {
    return null;
  }
}

function openWritable(path: string): DB | null {
  try {
    return new Database(path, { fileMustExist: true });
  } catch {
    return null;
  }
}

function ensureAlignedTableReadCheck(db: DB): void {
  // No-op when readonly; the table either exists or doesn't. We keep
  // the function signature consistent with the writable variant so
  // callers can swap in the future.
  void db;
}
