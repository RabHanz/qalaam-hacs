/**
 * /roots — every Quranic triliteral root, presented as an editorial
 * catalog. Designed for browsing, not data dumping.
 *
 * Information architecture (progressive disclosure):
 *   1. Hero with the count of roots + occurrences (anchors the scope).
 *   2. Featured row — the 8 most-frequent roots, large display type,
 *      gold occurrence chip. The Arabic letterforms get the visual
 *      weight, the English meta gets the secondary chrome.
 *   3. Search input — live-filters the long list as you type
 *      (Arabic OR Buckwalter OR English lemma).
 *   4. Alphabet rail — sticky tabs of the 28 Arabic letters, taps
 *      jump to that letter's section.
 *   5. Frequency tiers — Foundational (>500) opens by default;
 *      Common (100–500), Uncommon (10–100), Rare (<10) collapse
 *      until invited.
 *   6. Each root chip in the long list shows letters + count + lemma.
 *
 * Per CLAUDE.md adab non-negotiables: no XP, no leaderboards, no
 * gamified counters. The count is reverence ("this root carries 339
 * Quranic mentions"), not bragging rights.
 *
 * Data: /v1/morphology/roots → ~1700 roots from Quranic Arabic
 * Corpus v0.4 (GPL).
 */
import { Suspense } from 'react';

import { LoadingState } from '../../components/LoadingState.js';
import { RootsBrowser } from '../../components/RootsBrowser.js';
import { SiteNav } from '../../components/SiteNav.js';
import { rootInitialArabic, rootToArabic } from '../../lib/buckwalter.js';


import type { ReactNode } from 'react';

// Always render per-request — the backend is on the Docker network at
// http://qalaam-backend:4111 and ISN'T running during `next build`,
// so static generation would bake empty/null data. Per-request
// rendering hits the live backend each time.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Roots · Qalaam',
  description:
    'Every Quranic triliteral root traced from a single page — featured greats, ' +
    'searchable by letterforms or Buckwalter, browseable by Arabic alphabet.',
};

interface RootApi {
  readonly root: string;
  readonly count: number;
  readonly topForm: string;
  readonly lemma: string | null;
}

interface RootsApiResponse {
  readonly total: number;
  readonly roots: readonly RootApi[];
  readonly source: string;
  readonly license: string;
}

async function fetchRoots(): Promise<RootsApiResponse | null> {
  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  try {
    const res = await fetch(`${apiBase}/v1/morphology/roots`, {
      next: { revalidate: 604800 },
    });
    if (!res.ok) return null;
    return (await res.json()) as RootsApiResponse;
  } catch {
    return null;
  }
}

export default async function RootsPage(): Promise<ReactNode> {
  const data = await fetchRoots();
  const roots = data?.roots ?? [];
  const total = data?.total ?? 0;
  const totalOccurrences = roots.reduce((s, r) => s + r.count, 0);

  // Featured: top 8 most-frequent (data is already sorted desc by count)
  const featured = roots.slice(0, 8);

  // Tier buckets — informed by the actual distribution of Quranic
  // root frequencies. Foundational roots are the ~70 that carry >500
  // occurrences (think r-H-m, q-w-l, '-l-h, k-t-b, ...). The tail of
  // ~1000 hapax-legomena-adjacent roots gets its own section so the
  // long tail doesn't drown the substantive ones.
  const tiers = {
    foundational: roots.filter((r) => r.count > 500),
    common: roots.filter((r) => r.count > 100 && r.count <= 500),
    uncommon: roots.filter((r) => r.count > 10 && r.count <= 100),
    rare: roots.filter((r) => r.count <= 10),
  };

  // Arabic-letter index — every root keyed by initial radical.
  const lettersOrdered = [
    'ا',
    'ب',
    'ت',
    'ث',
    'ج',
    'ح',
    'خ',
    'د',
    'ذ',
    'ر',
    'ز',
    'س',
    'ش',
    'ص',
    'ض',
    'ط',
    'ظ',
    'ع',
    'غ',
    'ف',
    'ق',
    'ك',
    'ل',
    'م',
    'ن',
    'ه',
    'و',
    'ي',
    'ء',
  ];
  const lettersWithCount = lettersOrdered.map((letter) => ({
    letter,
    count: roots.filter((r) => rootInitialArabic(r.root) === letter).length,
  }));

  return (
    <>
      <SiteNav />

      {/* HERO — editorial, reverent, scope-anchoring */}
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Roots · جُذُور</p>
          <h1 className="font-display text-ink-strong mt-3 text-3xl font-light leading-[1.15] tracking-tight sm:text-4xl md:text-5xl">
            Every Quranic word, traced
            <br className="hidden sm:block" /> <span className="text-leaf-700">to its root.</span>
          </h1>
          <p className="text-ink-muted mt-4 max-w-prose text-sm leading-relaxed sm:text-base">
            Arabic words bloom from triliteral roots — three letters that carry a core meaning
            across every form they take. {total.toLocaleString()} roots span the Qur&apos;an in{' '}
            {totalOccurrences.toLocaleString()} word forms.
          </p>
          {data ? (
            <p className="text-ink-faint mt-3 text-xs">
              Source: {data.source}. License: {data.license}.
            </p>
          ) : null}
        </div>
      </header>

      {data === null || roots.length === 0 ? (
        <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className="border-hairline bg-surface rounded-2xl border p-8 text-center">
            <p className="text-ink-muted">
              The roots catalog is preparing — check back in a moment.
            </p>
          </div>
        </main>
      ) : (
        <>
          {/* FEATURED — the top-of-mind roots, large display type */}
          <section className="mx-auto max-w-5xl px-4 pb-2 pt-10 sm:px-6 sm:pt-14">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="font-display text-ink-strong text-xl font-light sm:text-2xl">
                Foundational roots
              </h2>
              <p className="text-ink-faint text-xs sm:text-sm">Most-frequent across the Mushaf</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {featured.map((r) => (
                <a
                  key={r.root}
                  href={`/concordance/root/${encodeURIComponent(r.root)}`}
                  className="border-hairline bg-surface hover:border-gold-500/50 hover:bg-surface-elevated group relative flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-6 transition-all"
                  aria-label={`Root ${rootToArabic(r.root)} (${r.root}) — ${r.count.toLocaleString()} Quranic occurrences`}
                >
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-ink-strong group-hover:text-leaf-700 text-4xl leading-none tracking-[0.2em] transition-colors sm:text-5xl"
                    style={{ fontFeatureSettings: '"liga" 0, "calt" 0' }}
                  >
                    {rootToArabic(r.root)}
                  </span>
                  <span className="text-gold-700/80 absolute right-3 top-2 text-[10px] font-medium tabular-nums tracking-wide">
                    {r.count.toLocaleString()}
                  </span>
                  {r.lemma ? (
                    <span
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-ink-muted text-xs opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {r.lemma}
                    </span>
                  ) : null}
                </a>
              ))}
            </div>
          </section>

          {/* INTERACTIVE BROWSER (search + filter + tier sections + index) */}
          <Suspense fallback={<LoadingState label="Loading the catalog…" lines={6} />}>
            <RootsBrowser tiers={tiers} lettersWithCount={lettersWithCount} total={total} />
          </Suspense>
        </>
      )}
    </>
  );
}
