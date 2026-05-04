/**
 * /mushaf/[layout]/[page] — page-faithful mushaf rendering.
 *
 * Renders one page of the chosen layout (madani_15, kfgqpc_v1, kfgqpc_v4)
 * line by line, using the actual word breaks from `qalaam_v1_qul_layouts_*`.
 * Each ayah-line is centered with the words flowing in mushaf order; the
 * first/last lines may show surah_name or basmallah glyphs.
 */
import Link from 'next/link';

import { EmptyState } from '../../../../components/EmptyState.js';
import { JumpToPicker } from '../../../../components/JumpToPicker.js';
import { MushafLines } from '../../../../components/MushafLines.js';
import { MushafPagePlayer } from '../../../../components/MushafPagePlayer.js';
import { MushafPageSwipe } from '../../../../components/MushafPageSwipe.js';
import { SiteNav } from '../../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ layout: string; page: string }>;
}

interface LayoutWord {
  readonly wordId: number;
  readonly wordIndex: number;
  readonly verseKey: string;
  readonly text: string;
}

interface LayoutLine {
  readonly lineNumber: number;
  readonly lineType: 'ayah' | 'surah_name' | 'basmallah';
  readonly alignment: 'centered' | 'justified' | string;
  readonly firstWordId: number | null;
  readonly lastWordId: number | null;
  readonly surah: number | null;
  readonly words: readonly LayoutWord[];
}

interface LayoutPage {
  readonly layout: string;
  readonly pageNumber: number;
  readonly linesPerPage: number;
  readonly lines: readonly LayoutLine[];
}

interface LayoutInfo {
  readonly slug: string;
  /** Pretty URL slug (madinah, indopak, tajweed). May fall back to slug. */
  readonly urlSlug?: string;
  readonly name: string;
  readonly subtitle?: string;
  readonly pageCount?: number;
}

async function fetchJson<T>(url: string, revalidate = 86400): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function arabicNumeral(n: number): string {
  return n.toString().split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d).join('');
}

export default async function MushafPage({ params }: PageProps): Promise<ReactNode> {
  const { layout, page } = await params;
  const pageNumber = Number.parseInt(page, 10);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20">
          <EmptyState title="Bad page number" hint={`Got "${page}".`} />
        </div>
      </>
    );
  }

  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';

  // Layout list metadata uses a short cache window so layout-name
  // updates propagate quickly. Page word data still long-cached
  // because it's stable.
  const [pageBody, layoutsBody] = await Promise.all([
    fetchJson<{ data: LayoutPage }>(`${apiBase}/v1/layouts/${encodeURIComponent(layout)}/page/${pageNumber.toString()}`, 60),
    fetchJson<{ layouts?: LayoutInfo[]; data?: string[] }>(`${apiBase}/v1/layouts`, 60),
  ]);

  if (!pageBody?.data) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20">
          <EmptyState
            title="Mushaf page not found"
            hint={`No data for layout '${layout}' page ${pageNumber.toString()}.`}
          />
        </div>
      </>
    );
  }

  const layouts = layoutsBody?.layouts ?? [];
  const activeLayout = layouts.find((l) => l.slug === layout) ?? null;
  const totalPages = activeLayout?.pageCount ?? 604;
  const data = pageBody.data;

  return (
    <>
      <SiteNav />

      {/* Editorial header */}
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-5 sm:py-7 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="smallcaps text-leaf text-[11px] tracking-widest">
              Mushaf · {activeLayout?.name ?? layout}
            </p>
            {activeLayout?.subtitle ? (
              <p className="text-[11px] text-ink-muted mt-0.5">{activeLayout.subtitle}</p>
            ) : null}
          </div>
          <p className="font-display text-2xl sm:text-3xl text-ink-strong tabular-nums">
            <span className="opacity-50">page</span> {arabicNumeral(pageNumber)}
            <span className="opacity-30 mx-1.5">/</span>
            <span className="text-base text-ink-muted">{totalPages.toString()}</span>
          </p>
        </div>
      </header>

      {/* Layout switcher */}
      <div className="border-b border-hairline bg-paper-100/85 backdrop-blur-md sticky top-[60px] sm:top-[68px] z-20">
        <div className="mx-auto max-w-5xl px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-thin">
          <span className="smallcaps text-leaf text-[10px] tracking-widest shrink-0 w-[64px]">
            Layout
          </span>
          <div className="flex items-center gap-1.5 min-w-max">
            {layouts.map((l) => (
              <Link
                key={l.slug}
                href={`/mushaf/${l.urlSlug ?? l.slug}/${pageNumber.toString()}`}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] sm:text-xs smallcaps tracking-wider transition-colors border ${
                  l.slug === layout
                    ? 'bg-leaf text-paper border-leaf'
                    : 'border-hairline text-ink hover:bg-paper-200/60'
                }`}
                title={l.subtitle}
              >
                {l.name.replace(/^Madinah Mushaf/, 'Madinah').replace(/^Madinah · /, '')}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Jump to surah / verse — floating action */}
      <JumpToPicker mode="mushaf" layoutSlug={layout} />

      {/* Page body — swipeable + slide-in animation per page */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <MushafPageSwipe layout={layout} pageNumber={pageNumber} totalPages={totalPages}>
        <article
          key={`${layout}-${pageNumber.toString()}`}
          className="paper-card-raised p-6 sm:p-10 md:p-14 slide-in-next"
          aria-label={`Mushaf page ${pageNumber.toString()}`}
        >
          <MushafLines lines={data.lines} layoutSlug={layout} sharedSize />
        </article>
        </MushafPageSwipe>

        <p className="text-[10px] smallcaps text-ink-muted/70 tracking-widest text-center pt-4 mt-4">
          Swipe ← for next page · Swipe → for previous
        </p>

        {/* Page nav */}
        <nav
          aria-label="Mushaf page navigation"
          className="mt-6 flex items-baseline justify-between text-sm"
        >
          {pageNumber > 1 ? (
            <Link
              href={`/mushaf/${layout}/${(pageNumber - 1).toString()}`}
              className="smallcaps text-ink-muted hover:text-leaf"
            >
              ← Page {arabicNumeral(pageNumber - 1)}
            </Link>
          ) : (
            <span />
          )}
          <Link href="/read/1" className="smallcaps text-ink-muted hover:text-leaf">
            Continuous reader
          </Link>
          {pageNumber < totalPages ? (
            <Link
              href={`/mushaf/${layout}/${(pageNumber + 1).toString()}`}
              className="smallcaps text-ink-muted hover:text-leaf"
            >
              Page {arabicNumeral(pageNumber + 1)} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>

      {/* Continuous-recitation player — Tarteel-style, plays through
          the verses on this page and chains into the next page/surah. */}
      <MushafPagePlayer
        lines={data.lines.map((l) => ({ lineType: l.lineType, words: l.words.map((w) => ({ verseKey: w.verseKey })) }))}
        initialSurah={
          (() => {
            for (const line of data.lines) {
              for (const w of line.words) {
                const s = Number.parseInt(w.verseKey.split(':')[0] ?? '1', 10);
                if (Number.isFinite(s)) return s;
              }
            }
            return 1;
          })()
        }
      />
    </>
  );
}
