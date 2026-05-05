/**
 * /listen/compare/[verseKey] — multi-reciter A/B comparison.
 *
 * Pick 2-4 reciters from the 51-row catalog, render their renditions of
 * the same verse stacked vertically with their own play button + word-
 * highlight. Useful for serious tajweed students studying how each
 * qari handles the same passage (the INTRO promise).
 *
 * Server-side: fetch the verse text + the reciter catalog. Client-side
 * picker + dual/triple HTMLAudioElement orchestration in CompareClient.
 */
import { CompareClient } from '../../../../components/CompareClient.js';
import { EmptyState } from '../../../../components/EmptyState.js';
import { SiteNav } from '../../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ verseKey: string }>;
}

export default async function ComparePage({ params }: PageProps): Promise<ReactNode> {
  const { verseKey } = await params;
  if (!/^[0-9]+:[0-9]+$/.test(verseKey)) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Bad verse key" hint={`Expected "S:A". Got "${verseKey}".`} />
        </div>
      </>
    );
  }
  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';

  let verseText = '';
  let reciters: { slug: string; name: string }[] = [];
  try {
    const [verseRes, recitersRes] = await Promise.all([
      fetch(`${apiBase}/v1/verses/by_key/${encodeURIComponent(verseKey)}`, {
        next: { revalidate: 604800 },
      }),
      fetch(`${apiBase}/v1/reciters`, { next: { revalidate: 86400 } }),
    ]);
    if (verseRes.ok) {
      const v = (await verseRes.json()) as { textUthmani: string };
      verseText = v.textUthmani;
    }
    if (recitersRes.ok) {
      const body = (await recitersRes.json()) as {
        reciters: { slug: string; name: { en: string } }[];
      };
      reciters = body.reciters.map((r) => ({ slug: r.slug, name: r.name.en }));
    }
  } catch {
    /* fall through */
  }

  return (
    <>
      <SiteNav />
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">A / B compare · مقارنة</p>
          <h1 className="font-display mt-2 text-3xl sm:text-5xl font-light tracking-tight text-ink-strong">
            {verseKey}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-ink-muted leading-relaxed max-w-prose">
            Listen to the same verse from up to four reciters side-by-side.
            Tap any verse to seek, tap any reciter to (un)solo.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        <CompareClient verseKey={verseKey} verseText={verseText} reciters={reciters} />
      </main>
    </>
  );
}
