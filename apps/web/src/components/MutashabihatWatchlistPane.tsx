/**
 * Mutashabihat watchlist surface.
 *
 * Reads /v1/mutashabihat/watchlist/:verseKey?limit=N and surfaces the top
 * most-confused-with ayahs as a small "watch out for…" pane. This is the
 * v2 confusion-resolution differentiator (Tarteel + Quranly don't ship it).
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
  baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4100',
  limit = 3,
}: MutashabihatWatchlistPaneProps): Promise<ReactNode> {
  const payload = await fetchWatchlist(baseUrl, verseKey, limit);
  if (!payload || payload.data.length === 0) return null;

  return (
    <aside
      aria-label={`Watch out for verses similar to ${verseKey}`}
      style={{
        background: 'var(--color-surface-raised, #fff)',
        borderRadius: '0.875rem',
        padding: '0.875rem 1rem',
        boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
        borderInlineStart: '3px solid var(--color-gold-500, #b6862c)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem' }}>Watch out for</h4>
        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          {payload.data.length.toString()} similar
        </span>
      </header>
      <ul
        style={{
          listStyle: 'none',
          margin: '0.5rem 0 0',
          padding: 0,
          display: 'grid',
          gap: '0.4rem',
        }}
      >
        {payload.data.map((p) => {
          const other = p.leftVerseKey === verseKey ? p.rightVerseKey : p.leftVerseKey;
          return (
            <li
              key={`${p.leftVerseKey}-${p.rightVerseKey}`}
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
            >
              <a
                href={`/study/${other.replace(':', '/')}`}
                style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}
              >
                {other}
              </a>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                {(p.score * 100).toFixed(0)}% similar
                {p.note ? ` · ${p.note}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
      <footer style={{ marginTop: '0.5rem', fontSize: '0.7rem', opacity: 0.55 }}>
        {payload.attribution}
      </footer>
    </aside>
  );
}
