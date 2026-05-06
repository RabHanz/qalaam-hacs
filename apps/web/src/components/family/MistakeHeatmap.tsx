'use client';

/**
 * MistakeHeatmap — 604-cell grid colored by mistake intensity.
 *
 * Aesthetic: a gentle warm-paper grid where cells deepen toward
 * `--color-mistake-error` (terracotta) as intensity rises. NOT a
 * shaming visualization — the copy frames it as "where to revisit."
 *
 * Layout: 30 columns × ~21 rows. Hover/tap reveals page number + count.
 * Tapping a cell links to /read/{surah-of-page} for review.
 *
 * Empty state: "No mistakes recorded yet" — neutral, not celebratory.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { mistakes, type HeatmapPage } from '../../lib/family-api.js';

import type { ReactNode } from 'react';

interface Props {
  readonly userId?: string;
  readonly userDisplayName?: string;
  readonly windowDays?: number;
}

const PAGE_COUNT = 604;
const COLS = 31;
const ROWS = Math.ceil(PAGE_COUNT / COLS);

function intensityColor(intensity: number): string {
  if (intensity <= 0) return 'var(--color-paper-100)';
  // Map [0..1] → stepped warm-paper → terracotta scale.
  // Five steps so sparse data still differentiates.
  if (intensity < 0.2) return '#f6e6c2';
  if (intensity < 0.4) return '#eecf94';
  if (intensity < 0.6) return '#dfa463';
  if (intensity < 0.8) return '#c97448';
  return '#a8472b';
}

export function MistakeHeatmap({ userId, userDisplayName, windowDays = 30 }: Props): ReactNode {
  const [pages, setPages] = useState<readonly HeatmapPage[] | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const args: { days: number; userId?: string } = { days: windowDays };
    if (userId !== undefined) args.userId = userId;
    mistakes
      .heatmap(args)
      .then((data) => {
        if (cancelled) return;
        setPages(data.pages);
        setTotal(data.totalMistakes);
        setOpen(data.openMistakes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { code?: string; status?: number };
        if (e.status === 401) {
          // Anonymous — quietly hide; the page header has a sign-in CTA already.
          setPages([]);
          return;
        }
        setError('Could not load the heatmap right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [userId, windowDays]);

  const indexed = useMemo(() => {
    const map = new Map<number, HeatmapPage>();
    if (pages) for (const p of pages) map.set(p.page, p);
    return map;
  }, [pages]);

  if (loading) {
    return (
      <div className="border-hairline bg-paper rounded-2xl border p-6">
        <div className="bg-paper-100 mb-3 h-4 w-32 animate-pulse rounded" />
        <div className="bg-paper-100 grid h-44 animate-pulse rounded" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="border-hairline bg-paper rounded-2xl border p-6">
        <p className="text-ink-muted text-sm">{error}</p>
      </div>
    );
  }
  if (!pages || (pages.length === 0 && total === 0)) {
    return (
      <div className="border-hairline bg-paper rounded-2xl border p-6">
        <header className="mb-3">
          <h3
            className="text-ink-strong text-lg"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            Where to revisit
          </h3>
          <p className="text-ink-muted text-xs leading-relaxed">
            No mistakes recorded in the last {windowDays.toString()} days
            {userDisplayName ? ` for ${userDisplayName}` : ''}. Recite-and-check sessions feed this
            heatmap automatically.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="border-hairline bg-paper rounded-2xl border p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3
            className="text-ink-strong text-lg"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            Where to revisit
          </h3>
          <p className="text-ink-muted text-xs leading-relaxed">
            {total.toString()} mistake{total === 1 ? '' : 's'} in the last {windowDays.toString()}{' '}
            days
            {userDisplayName ? ` · ${userDisplayName}` : ''} ·{' '}
            <span className="text-mistake-error">{open.toString()} open</span>
          </p>
        </div>
        <Legend />
      </header>

      <div
        role="grid"
        aria-label="Mistake heatmap by mushaf page"
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${COLS.toString()}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: ROWS * COLS }, (_, i) => {
          const page = i + 1;
          if (page > PAGE_COUNT) {
            return <div key={page} aria-hidden style={{ visibility: 'hidden' }} />;
          }
          const data = indexed.get(page);
          const intensity = data?.intensity ?? 0;
          const fill = intensityColor(intensity);
          const count = data?.total ?? 0;
          const openCount = data?.open ?? 0;
          return (
            <Link
              key={page}
              href={`/mushaf/madinah/${page.toString()}`}
              role="gridcell"
              aria-label={`Page ${page.toString()}, ${count.toString()} mistake${count === 1 ? '' : 's'}, ${openCount.toString()} open`}
              title={`Page ${page.toString()} · ${count.toString()} mistake${count === 1 ? '' : 's'} (${openCount.toString()} open)`}
              className="aspect-square rounded-[3px] transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-leaf-500)]"
              style={{ background: fill, opacity: count === 0 ? 0.55 : 1 }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Legend(): ReactNode {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-ink-muted smallcaps tracking-widest">Less</span>
      {[0.05, 0.25, 0.5, 0.75, 0.95].map((i) => (
        <span
          key={i}
          aria-hidden
          className="h-3 w-3 rounded-[2px]"
          style={{ background: intensityColor(i) }}
        />
      ))}
      <span className="text-ink-muted smallcaps tracking-widest">More</span>
    </div>
  );
}
