/**
 * /concordance/root/:root — every Quranic word sharing a triliteral
 * root. Editorial layout with the root in display type at the top
 * + every occurrence linkable to /study/:s/:a.
 *
 * Source: Quranic Arabic Corpus (Kais Dukes, 2011) via
 * /v1/morphology/root/:root.
 */
import Link from 'next/link';

import { EmptyState } from '../../../../components/EmptyState.js';
import { SiteNav } from '../../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ root: string }>;
}

interface ApiOccurrence {
  readonly verseKey: string;
  readonly wordIndex: number;
  readonly form: string;
  readonly lemma: string | null;
  readonly tag: string;
}

interface ApiResponse {
  readonly root: string;
  readonly count: number;
  readonly occurrences: readonly ApiOccurrence[];
  readonly source: string;
  readonly license: string;
}

/**
 * Buckwalter root → human-readable Arabic.
 */
const BW_TO_AR: Record<string, string> = {
  "'": 'ء', '|': 'آ', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ',
  A: 'ا', b: 'ب', t: 'ت', v: 'ث', j: 'ج',
  H: 'ح', x: 'خ', d: 'د', '*': 'ذ', r: 'ر', z: 'ز',
  s: 'س', $: 'ش', S: 'ص', D: 'ض', T: 'ط', Z: 'ظ',
  E: 'ع', g: 'غ', f: 'ف', q: 'ق', k: 'ك',
  l: 'ل', m: 'م', n: 'n'.replace('n', 'ن'), h: 'ه', w: 'و', Y: 'ى', y: 'ي',
};
function rootToArabic(bw: string): string {
  return bw.split('').map((c) => BW_TO_AR[c] ?? c).join('');
}

export default async function RootConcordancePage({ params }: PageProps): Promise<ReactNode> {
  const { root: rawRoot } = await params;
  const root = decodeURIComponent(rawRoot);

  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  const res = await fetch(`${apiBase}/v1/morphology/root/${encodeURIComponent(root)}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Root not found" hint={`No data for root "${root}".`} />
        </div>
      </>
    );
  }
  const body = (await res.json()) as ApiResponse;

  return (
    <>
      <SiteNav />
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Root concordance · جذر</p>
          <div className="mt-3 flex items-end gap-6 flex-wrap">
            <p
              dir="rtl"
              lang="ar"
              className="text-ink-strong"
              style={{
                fontFamily: '"UthmanicHafs", "Amiri Quran", serif',
                fontSize: 'clamp(3rem, 2rem + 4vw, 5rem)',
                fontWeight: 700,
                lineHeight: 1,
                unicodeBidi: 'plaintext',
              }}
            >
              {rootToArabic(body.root)}
            </p>
            <div className="flex-1 min-w-[10rem]">
              <h1 className="font-display text-2xl sm:text-3xl font-light tracking-tight text-ink-strong">
                Root <code className="font-mono">{body.root}</code>
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                {body.count.toString()} occurrences across the Quran
              </p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        {body.occurrences.length === 0 ? (
          <EmptyState title="No occurrences" hint={`Root "${root}" has no recorded uses.`} />
        ) : (
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0">
            {body.occurrences.map((o) => (
              <li key={`${o.verseKey}-${o.wordIndex.toString()}`}>
                <Link
                  href={`/study/${o.verseKey.split(':')[0] ?? '1'}/${o.verseKey.split(':')[1] ?? '1'}`}
                  className="paper-card hover-rise flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="smallcaps font-mono text-[10px] tabular-nums text-ink-muted shrink-0">
                    {o.verseKey}
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-lg sm:text-xl text-ink-strong"
                    style={{
                      fontFamily: '"UthmanicHafs", "Amiri Quran", serif',
                      unicodeBidi: 'plaintext',
                    }}
                  >
                    {o.form}
                  </span>
                  <span className="smallcaps text-[10px] text-leaf tracking-widest shrink-0">
                    {o.tag}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-8 text-[10px] text-ink-muted text-center italic">
          {body.source} · {body.license}
        </p>
      </main>
    </>
  );
}
