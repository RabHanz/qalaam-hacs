/**
 * /mushaf-image/[page] — image-faithful Madani 16-line mushaf surface.
 *
 * Renders the original KFGQPC page render as a high-DPI image with
 * absolute-positioned word rectangles laid on top so we can:
 *   - highlight a word on hover/tap
 *   - tap a word to deep-link into /study/:s/:a
 *   - keep the page itself perfectly faithful (no font rendering drift)
 *
 * Why this matters per JTBD: serious memorizers hold a *visual* memory
 * of the mushaf — the position of every word on every page. Reflowed
 * mushafs (even tasteful ones like our /mushaf/madinah surface) break
 * that mental model. Page images preserve it pixel-for-pixel.
 *
 * Source: QUL mushaf-layout-12 (Madani 16-line) — 610 pages, 83K word
 * rectangles, ingested via scripts/data/ingest-image-mushaf-overlays.py.
 */
import Link from 'next/link';

import { EmptyState } from '../../../components/EmptyState.js';
import { ImageMushafCanvas } from '../../../components/ImageMushafCanvas.js';
import { SiteNav } from '../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ page: string }>;
}

interface ApiResponse {
  readonly layoutId: string;
  readonly layoutSlug: string;
  readonly page: number;
  readonly imageUrl: string;
  readonly words: readonly {
    readonly surah: number;
    readonly ayah: number;
    readonly word: number;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  }[];
}

const TOTAL_PAGES = 610;
const LAYOUT_SLUG = 'madani-16';

export default async function ImageMushafPage({ params }: PageProps): Promise<ReactNode> {
  const { page: pageParam } = await params;
  const page = Number.parseInt(pageParam, 10);
  if (!Number.isFinite(page) || page < 1 || page > TOTAL_PAGES) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Page out of range" hint={`Pages 1 – ${TOTAL_PAGES.toString()}.`} />
        </div>
      </>
    );
  }

  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  let body: ApiResponse | null = null;
  try {
    const res = await fetch(`${apiBase}/v1/image-mushaf/${LAYOUT_SLUG}/${page.toString()}`, {
      next: { revalidate: 604800 },
    });
    if (res.ok) body = (await res.json()) as ApiResponse;
  } catch {
    /* fall through */
  }
  if (!body) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState
            title="Page not yet ingested"
            hint={`Run scripts/data/ingest-image-mushaf-overlays.py to populate page ${page.toString()}.`}
          />
        </div>
      </>
    );
  }

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < TOTAL_PAGES ? page + 1 : null;

  return (
    <>
      <SiteNav />

      <header className="border-hairline border-b">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between px-4 py-4 sm:px-6">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">
            Madani 16-line · Image · KFGQPC
          </p>
          <p className="smallcaps text-ink-muted text-[11px] tabular-nums tracking-widest">
            Page {page.toString()} / {TOTAL_PAGES.toString()}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
        <ImageMushafCanvas imageUrl={body.imageUrl} words={body.words} page={page} />

        <nav
          aria-label="Mushaf page navigation"
          className="border-hairline mt-6 flex items-baseline justify-between border-t pt-8 text-sm"
        >
          {prevPage !== null ? (
            <Link
              href={`/mushaf-image/${prevPage.toString()}`}
              className="smallcaps text-ink-muted hover:text-leaf"
            >
              ← Page {prevPage.toString()}
            </Link>
          ) : (
            <span />
          )}
          {nextPage !== null ? (
            <Link
              href={`/mushaf-image/${nextPage.toString()}`}
              className="smallcaps text-ink-muted hover:text-leaf"
            >
              Page {nextPage.toString()} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>
    </>
  );
}
