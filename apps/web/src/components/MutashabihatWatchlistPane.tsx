/**
 * Mutashabihat watchlist — marginalia for the deep-study reader.
 *
 * Reads /v1/mutashabihat/watchlist/:verseKey?limit=N. Renders as a side-
 * margin "watch out for" panel with deep-link previews, like a critical
 * edition's apparatus. Differentiator vs. Tarteel/Quranly which neither
 * ship full mutashabihat watch.
 *
 * Per ADR-0020 + Phase 17 §17.5.
 */
import type { ReactNode } from 'react';

interface Pair {
  leftVerseKey: string;
  rightVerseKey: string;
  score: number;
  note: string | null;
}

interface WatchlistPayload {
  data: Pair[];
  attribution: string;
  license: string;
}

async function fetchWatchlist(
  baseUrl: string,
  verseKey: string,
  limit: number,
): Promise<WatchlistPayload | null> {
  try {
    const url = new URL(`${baseUrl}/v1/mutashabihat/watchlist/${encodeURIComponent(verseKey)}`);
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!res.ok) return null;
    return (await res.json()) as WatchlistPayload;
  } catch {
    return null;
  }
}

export interface MutashabihatWatchlistPaneProps {
  readonly verseKey: string;
  readonly baseUrl?: string;
  readonly limit?: number;
}

export async function MutashabihatWatchlistPane({
  verseKey,
  baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4111',
  limit = 4,
}: MutashabihatWatchlistPaneProps): Promise<ReactNode> {
  const payload = await fetchWatchlist(baseUrl, verseKey, limit);

  if (!payload || payload.data.length === 0) {
    return (
      <aside className="paper-card p-5">
        <p className="smallcaps text-leaf text-xs">Mutashabihat</p>
        <p className="mt-2 text-sm italic text-ink-muted leading-relaxed">
          No similar passages flagged for {verseKey} yet.
        </p>
      </aside>
    );
  }

  return (
    <aside
      aria-label={`Mutashabihat watchlist for ${verseKey}`}
      className="paper-card-raised p-5 border-l-4 border-l-[var(--color-leaf-500)]"
    >
      <div className="flex items-baseline justify-between mb-3">
        <p className="smallcaps text-leaf text-xs">Watch out for</p>
        <span className="text-[10px] smallcaps text-ink-muted">
          {payload.data.length.toString()} similar
        </span>
      </div>
      <ul className="grid gap-2 list-none p-0 m-0">
        {payload.data.map((p) => {
          const other = p.leftVerseKey === verseKey ? p.rightVerseKey : p.leftVerseKey;
          return (
            <li key={`${p.leftVerseKey}-${p.rightVerseKey}`}>
              <a
                href={`/study/${other.replace(':', '/')}`}
                className="group block py-2 border-b border-hairline last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-base tabular-nums text-ink group-hover:text-leaf transition-colors">
                    {other}
                  </span>
                  <span className="text-[11px] smallcaps text-ink-muted">
                    {(p.score * 100).toFixed(0)}% match
                  </span>
                </div>
                {p.note ? (
                  <p className="mt-1 text-xs text-ink-muted leading-snug">{p.note}</p>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
      <a
        href={`/drill/mutashabihat/${encodeURIComponent(verseKey)}`}
        className="smallcaps text-leaf hover:bg-leaf hover:text-paper border-leaf mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] tracking-widest transition-colors"
      >
        Side-by-side drill →
      </a>
      <p className="mt-3 text-[10px] smallcaps text-ink-muted">{payload.attribution}</p>
    </aside>
  );
}
