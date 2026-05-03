/**
 * Mutashabihat-aware scheduling helpers. Per strategy §7.2 + §24.
 *
 * The principle: when a user mistakenly recites verse Y while attempting verse X,
 * X and Y form a confusion edge. The next session should surface BOTH X and Y
 * back-to-back so the user can practice the divergence point deliberately.
 */
import { type VerseKey } from '@qalaam/core';

export interface ConfusionEdge {
  /** Verse the user was attempting. */
  readonly intended: VerseKey;
  /** Verse the user accidentally recited from. */
  readonly swappedTo: VerseKey;
  /** Times this confusion has been observed. */
  readonly count: number;
  readonly lastSeenAt: string; // ISO-8601
}

export interface ConfusionGraph {
  readonly edges: readonly ConfusionEdge[];
}

/** Build/update the confusion graph from a sequence of mistake events. */
export function ingestSwap(
  graph: ConfusionGraph,
  intended: VerseKey,
  swappedTo: VerseKey,
  at: Date,
): ConfusionGraph {
  const existing = graph.edges.find(
    (e) => e.intended === intended && e.swappedTo === swappedTo,
  );
  if (existing) {
    return {
      edges: graph.edges.map((e) =>
        e === existing
          ? { ...existing, count: existing.count + 1, lastSeenAt: at.toISOString() }
          : e,
      ),
    };
  }
  return {
    edges: [
      ...graph.edges,
      { intended, swappedTo, count: 1, lastSeenAt: at.toISOString() },
    ],
  };
}

/** Verses that the user has historically swapped with `verseKey`. */
export function siblingsOf(
  graph: ConfusionGraph,
  verseKey: VerseKey,
  options: { minCount?: number } = {},
): readonly VerseKey[] {
  const minCount = options.minCount ?? 1;
  const out = new Set<VerseKey>();
  for (const e of graph.edges) {
    if (e.count < minCount) continue;
    if (e.intended === verseKey) out.add(e.swappedTo);
    else if (e.swappedTo === verseKey) out.add(e.intended);
  }
  return [...out];
}
