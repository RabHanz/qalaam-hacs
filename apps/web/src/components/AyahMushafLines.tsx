'use client';

/**
 * AyahMushafLines — render a single ayah using the EXACT mushaf line
 * breaks of the selected layout (madani_15, kfgqpc_v1, kfgqpc_v4).
 *
 * Strategy:
 *  1. Look up which page contains the verse.
 *  2. Fetch that page's line+word data.
 *  3. Filter to the lines whose words include the target verseKey.
 *  4. Render each such line via <MushafLine /> — same auto-fit logic as
 *     the full mushaf page mode.
 *
 * This unlocks the user-requested behavior: in single-ayah view of /read,
 * the ayah can be displayed as it appears on the printed mushaf — same
 * line breaks, same end-of-ayah rosette, same proportional sizing.
 */
import { useEffect, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import { MushafLines } from './MushafLines.js';

import type { ReactNode } from 'react';

interface LayoutWord {
  readonly wordId: number;
  readonly wordIndex: number;
  readonly verseKey: string;
  readonly text: string;
}

interface LayoutLine {
  readonly lineNumber: number;
  readonly lineType: 'ayah' | 'surah_name' | 'basmallah';
  readonly alignment: string;
  readonly firstWordId: number | null;
  readonly lastWordId: number | null;
  readonly surah: number | null;
  readonly words: readonly LayoutWord[];
}

interface Props {
  /** Optional — ignored at runtime; we always resolve to the same-origin
   *  proxy. Kept so existing call-sites compile without churn. */
  readonly apiBase?: string;
  readonly verseKey: string;
  readonly layoutSlug: string;
  /** Optional active-word highlight. If verseKey matches, the
   *  matching word in the mushaf rendering is colored. */
  readonly highlight?: { verseKey: string; wordIndex: number } | null;
}

interface CacheEntry {
  pageNumber: number;
  lines: readonly LayoutLine[];
}

const pageCache = new Map<string, CacheEntry>();

export function AyahMushafLines({ verseKey, layoutSlug, highlight }: Props): ReactNode {
  const apiBase = resolveApiBase();
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    lines: readonly LayoutLine[];
    pageNumber: number | null;
  }>({ loading: true, error: null, lines: [], pageNumber: null });

  useEffect(() => {
    // Object-cell pattern: the cleanup closure flips `cancel.v` async,
    // which a `let cancelled = false` rebind can't represent without
    // tripping no-inferrable-types vs no-unnecessary-condition cross-fire.
    const cancel = { v: false };
    setState({ loading: true, error: null, lines: [], pageNumber: null });

    const cacheKey = `${layoutSlug}|${verseKey}`;
    const cached = pageCache.get(cacheKey);
    if (cached) {
      const filtered = cached.lines.filter((l) => l.words.some((w) => w.verseKey === verseKey));
      setState({ loading: false, error: null, lines: filtered, pageNumber: cached.pageNumber });
      return;
    }

    void (async () => {
      try {
        // Step 1: find which page the verse lives on.
        const pageRes = await fetch(
          `${apiBase}/v1/layouts/${encodeURIComponent(layoutSlug)}/by-verse/${encodeURIComponent(verseKey)}`,
        );
        if (!pageRes.ok) throw new Error(`page lookup failed (${pageRes.status.toString()})`);
        const pageBody = (await pageRes.json()) as { data: { page: number } };
        const pageNumber = pageBody.data.page;

        // Step 2: fetch that page's lines+words.
        const linesRes = await fetch(
          `${apiBase}/v1/layouts/${encodeURIComponent(layoutSlug)}/page/${pageNumber.toString()}`,
        );
        if (!linesRes.ok) throw new Error(`page fetch failed (${linesRes.status.toString()})`);
        const linesBody = (await linesRes.json()) as { data: { lines: LayoutLine[] } };

        // Step 3: cache + filter to lines AND words matching this verse.
        // A mushaf line can span multiple verses (e.g. last word of 2:2
        // + first words of 2:3 share the same printed line). For
        // single-ayah view we only want the words of the requested
        // verse — slicing the words array preserves correct ordering
        // (word_id is already mushaf-global asc from the backend).
        pageCache.set(cacheKey, { pageNumber, lines: linesBody.data.lines });
        const filtered: LayoutLine[] = linesBody.data.lines
          .filter((l) => l.words.some((w) => w.verseKey === verseKey))
          .map((l) => ({
            ...l,
            words: l.words.filter((w) => w.verseKey === verseKey),
          }));

        if (!cancel.v) {
          setState({ loading: false, error: null, lines: filtered, pageNumber });
        }
      } catch (err) {
        if (!cancel.v) {
          setState({
            loading: false,
            error: err instanceof Error ? err.message : 'unknown error',
            lines: [],
            pageNumber: null,
          });
        }
      }
    })();

    return () => {
      cancel.v = true;
    };
  }, [apiBase, verseKey, layoutSlug]);

  if (state.loading) {
    return (
      <div className="paper-card p-6 text-center sm:p-8">
        <p className="smallcaps text-leaf mb-2 text-[11px] tracking-widest">Mushaf line</p>
        <p className="text-ink-muted text-sm italic">Loading layout…</p>
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="paper-card p-6 sm:p-8">
        <p className="text-ink-muted text-sm italic">
          Could not render mushaf for this ayah ({state.error}).
        </p>
      </div>
    );
  }
  if (state.lines.length === 0) {
    return (
      <div className="paper-card p-6 text-center sm:p-8">
        <p className="text-ink-muted text-sm italic">No mushaf lines available for {verseKey}.</p>
      </div>
    );
  }
  return (
    <article
      className="paper-card-raised p-5 sm:p-8 md:p-10"
      aria-label={`Mushaf rendering of ayah ${verseKey}`}
    >
      <header className="mb-4 flex items-baseline justify-between">
        <p className="smallcaps text-leaf text-[10px] tracking-widest sm:text-[11px]">
          Mushaf line
        </p>
        {state.pageNumber !== null ? (
          <a
            href={`/mushaf/${layoutSlug}/${state.pageNumber.toString()}`}
            className="smallcaps text-ink-muted hover:text-leaf text-[11px] tracking-widest sm:text-xs"
          >
            Page {state.pageNumber.toString()} →
          </a>
        ) : null}
      </header>
      <MushafLines
        lines={state.lines}
        layoutSlug={layoutSlug}
        sharedSize
        highlight={highlight ?? null}
      />
    </article>
  );
}
