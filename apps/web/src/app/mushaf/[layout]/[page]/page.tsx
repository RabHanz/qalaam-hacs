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
import { TajweedLegend } from '../../../../components/TajweedLegend.js';

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
  readonly alignment: string;
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
  return n
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
    .join('');
}

// Always render per-request — the backend is on the Docker network at
// http://qalaam-backend:4111 and ISN'T running during `next build`,
// so static generation would bake empty/null data. Per-request
// rendering hits the live backend each time.
export const dynamic = 'force-dynamic';

export default async function MushafPage({ params }: PageProps): Promise<ReactNode> {
  const { layout, page } = await params;
  const pageNumber = Number.parseInt(page, 10);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
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
    fetchJson<{ data: LayoutPage }>(
      `${apiBase}/v1/layouts/${encodeURIComponent(layout)}/page/${pageNumber.toString()}`,
      60,
    ),
    fetchJson<{ layouts?: LayoutInfo[]; data?: string[] }>(`${apiBase}/v1/layouts`, 60),
  ]);

  if (!pageBody?.data) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <EmptyState
            title="This page isn't available"
            hint="Try a different page or layout from the menu above."
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
      <header className="border-hairline border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-3 px-4 py-5 sm:px-6 sm:py-7">
          <div>
            <p className="smallcaps text-leaf text-[11px] tracking-widest">
              Mushaf · {activeLayout?.name ?? layout}
            </p>
            {activeLayout?.subtitle ? (
              <p className="text-ink-muted mt-0.5 text-[11px]">{activeLayout.subtitle}</p>
            ) : null}
          </div>
          <p className="font-display text-ink-strong text-2xl tabular-nums sm:text-3xl">
            <span className="opacity-50">page</span> {arabicNumeral(pageNumber)}
            <span className="mx-1.5 opacity-30">/</span>
            <span className="text-ink-muted text-base">{totalPages.toString()}</span>
          </p>
        </div>
      </header>

      {/* Layout switcher + Exit-to-reader */}
      <div className="border-hairline bg-paper-100/85 sticky top-[60px] z-20 border-b backdrop-blur-md sm:top-[68px]">
        <div className="scrollbar-thin mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-3 py-2.5 sm:px-6">
          <span className="smallcaps text-leaf w-[64px] shrink-0 text-[10px] tracking-widest">
            Layout
          </span>
          <div className="flex min-w-max flex-1 items-center gap-1.5">
            {layouts.map((l) => (
              <Link
                key={l.slug}
                href={`/mushaf/${l.urlSlug ?? l.slug}/${pageNumber.toString()}`}
                className={`smallcaps shrink-0 rounded-full border px-3 py-1 text-[11px] tracking-wider transition-colors sm:text-xs ${
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
          {/* Exit mushaf — jump to /read for the FIRST surah on this
              page so the user lands somewhere meaningful. */}
          {(() => {
            // Find the first ayah verseKey on this page.
            let firstVk = '1:1';
            for (const line of data.lines) {
              const w = line.words[0];
              if (w?.verseKey) {
                firstVk = w.verseKey;
                break;
              }
            }
            const surah = firstVk.split(':')[0] ?? '1';
            return (
              <>
                <Link
                  href={`/mushaf-image/page-for/${encodeURIComponent(firstVk)}`}
                  title="Switch to image-faithful KFGQPC page (preserves the visual position of every word)"
                  className="smallcaps border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 ml-2 inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] tracking-wider sm:text-xs"
                >
                  As image
                </Link>
                <Link
                  href={`/read/${surah}#${firstVk}`}
                  title="Switch to continuous / one-ayah reader"
                  className="smallcaps border-leaf/40 text-leaf hover:bg-leaf/10 ml-2 inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] tracking-wider sm:text-xs"
                >
                  <svg
                    width={11}
                    height={11}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden
                  >
                    <path d="M9 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Exit mushaf
                </Link>
              </>
            );
          })()}
        </div>
      </div>

      {/* Jump to surah / verse — floating action */}
      <JumpToPicker mode="mushaf" layoutSlug={layout} />

      {/* Tajweed legend — only on the tajweed mushaf surface */}
      {layout === 'tajweed' || layout === 'kfgqpc_v4' ? <TajweedLegend /> : null}

      {/* Page body — swipeable + slide-in animation per page */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <MushafPageSwipe layout={layout} pageNumber={pageNumber} totalPages={totalPages}>
          <article
            key={`${layout}-${pageNumber.toString()}`}
            className="paper-card-raised slide-in-next p-6 sm:p-10 md:p-14"
            aria-label={`Mushaf page ${pageNumber.toString()}`}
          >
            <MushafLines lines={data.lines} layoutSlug={layout} sharedSize />
          </article>
        </MushafPageSwipe>

        <p className="smallcaps text-ink-muted/70 mt-4 pt-4 text-center text-[10px] tracking-widest">
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
        lines={data.lines.map((l) => ({
          lineType: l.lineType,
          words: l.words.map((w) => ({ verseKey: w.verseKey })),
        }))}
        initialSurah={(() => {
          for (const line of data.lines) {
            for (const w of line.words) {
              const s = Number.parseInt(w.verseKey.split(':')[0] ?? '1', 10);
              if (Number.isFinite(s)) return s;
            }
          }
          return 1;
        })()}
      />
    </>
  );
}
