/**
 * Extended mutashabihat loader (QUL resource: similar-ayah-pairs + full
 * mutashabihat 5,277 phrases).
 *
 * The original `index.ts::getMutashabihatCluster` returns the small slice we
 * shipped in v0.1. This module wraps the full QUL set and exposes both:
 *   - phrase-level clusters (5,277 rows; "these N verses share this phrase")
 *   - ayah-level pairs (4,001 rows; "this ayah is similar to that ayah")
 *
 * Both feed the v2 Hifdh confusion-resolution engine — the differentiator
 * neither Tarteel nor Quranly ships.
 *
 * Per ADR-0020: schema name `qalaam_v1_qul_mutashabihat_v2_*` so the v0.1
 * reader's `qalaam_v1_mutashabihat` table stays untouched until consumers
 * migrate.
 */
import type { Database as DB, Statement } from 'better-sqlite3';

import type { LicenseMetadata } from './license.js';

export interface PhraseCluster {
  readonly clusterId: string;
  readonly sharedPhrase: string;
  readonly memberVerseKeys: readonly string[];
  /** Position of the phrase within each member ayah, when known. */
  readonly memberOffsets: readonly { verseKey: string; wordStart: number; wordEnd: number }[];
}

export interface AyahSimilarityPair {
  readonly leftVerseKey: string;
  readonly rightVerseKey: string;
  /** 0..1 — higher = more similar; QUL exposes a per-pair score for many rows. */
  readonly score: number;
  /** Optional human-readable note (e.g., "differs only in plural form"). */
  readonly note: string | null;
}

export interface MutashabihatExtendedReader {
  readonly meta: LicenseMetadata;
  /** Full phrase cluster lookup by verse_key (returns clusters whose member set contains the key). */
  clustersForAyah(verseKey: string): readonly PhraseCluster[];
  /** All similarity pairs involving a given ayah. */
  pairsForAyah(verseKey: string): readonly AyahSimilarityPair[];
  /**
   * Top-N most-confused-with ayahs for a given verse_key. Ranked by score desc.
   * Powers the "watch out for…" surface in the Hifdh review UI.
   */
  watchlistFor(verseKey: string, limit?: number): readonly AyahSimilarityPair[];
}

interface RawCluster {
  cluster_id: string;
  shared_phrase: string;
  member_verse_keys: string;
  member_offsets: string | null;
}

interface RawPair {
  left_verse_key: string;
  right_verse_key: string;
  score: number;
  note: string | null;
}

export function buildMutashabihatExtendedReader(
  db: DB,
  meta: LicenseMetadata,
): MutashabihatExtendedReader {
  const stmt = {
    clustersByAyah: db.prepare<[string], RawCluster>(
      `SELECT cluster_id, shared_phrase, member_verse_keys, member_offsets
       FROM qalaam_v1_qul_mutashabihat_v2_clusters
       WHERE EXISTS (
         SELECT 1 FROM json_each(member_verse_keys) WHERE value = ?
       )`,
    ),
    pairsByAyah: db.prepare<[string, string], RawPair>(
      `SELECT left_verse_key, right_verse_key, score, note
       FROM qalaam_v1_qul_mutashabihat_v2_pairs
       WHERE left_verse_key = ? OR right_verse_key = ?
       ORDER BY score DESC`,
    ),
    watchlist: db.prepare<[string, string, number], RawPair>(
      `SELECT left_verse_key, right_verse_key, score, note
       FROM qalaam_v1_qul_mutashabihat_v2_pairs
       WHERE left_verse_key = ? OR right_verse_key = ?
       ORDER BY score DESC
       LIMIT ?`,
    ),
  } satisfies Record<string, Statement<unknown[], unknown>>;

  function decodeCluster(r: RawCluster): PhraseCluster {
    const members = JSON.parse(r.member_verse_keys) as string[];
    const offsets = r.member_offsets
      ? (JSON.parse(r.member_offsets) as { verseKey: string; wordStart: number; wordEnd: number }[])
      : [];
    return {
      clusterId: r.cluster_id,
      sharedPhrase: r.shared_phrase,
      memberVerseKeys: members,
      memberOffsets: offsets,
    };
  }

  function decodePair(r: RawPair): AyahSimilarityPair {
    return {
      leftVerseKey: r.left_verse_key,
      rightVerseKey: r.right_verse_key,
      score: r.score,
      note: r.note,
    };
  }

  return {
    meta,
    clustersForAyah(verseKey) {
      return stmt.clustersByAyah.all(verseKey).map(decodeCluster);
    },
    pairsForAyah(verseKey) {
      return stmt.pairsByAyah.all(verseKey, verseKey).map(decodePair);
    },
    watchlistFor(verseKey, limit = 5) {
      return stmt.watchlist.all(verseKey, verseKey, limit).map(decodePair);
    },
  };
}
