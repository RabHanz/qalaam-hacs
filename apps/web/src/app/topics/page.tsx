/**
 * /topics — topical index. Editorial subject-index layout: each
 * top-level category becomes a section header (Faith / Worship / etc),
 * sub-topics laid out as a paper-card grid linking to /topics/[slug].
 */
import Link from 'next/link';

import { EmptyState } from '../../components/EmptyState.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface ApiTopic {
  readonly slug: string;
  readonly nameEn: string;
  readonly nameAr: string | null;
  readonly summary: string | null;
  readonly verseCount: number;
}
interface ApiCategory {
  readonly slug: string;
  readonly nameEn: string;
  readonly nameAr: string | null;
  readonly topics: readonly ApiTopic[];
}

// Always render per-request — the backend is on the Docker network at
// http://qalaam-backend:4111 and ISN'T running during `next build`,
// so static generation would bake empty/null data. Per-request
// rendering hits the live backend each time.
export const dynamic = 'force-dynamic';

export default async function TopicsPage(): Promise<ReactNode> {
  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  let categories: readonly ApiCategory[] = [];
  try {
    const res = await fetch(`${apiBase}/v1/topics`, { next: { revalidate: 86400 } });
    if (res.ok) {
      const body = (await res.json()) as { categories: readonly ApiCategory[] };
      categories = body.categories;
    }
  } catch {
    /* ignore — render empty state below */
  }

  return (
    <>
      <SiteNav />
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Topical index · مواضيع</p>
          <h1 className="font-display text-ink-strong mt-2 text-3xl font-light tracking-tight sm:text-5xl md:text-6xl">
            Subjects of the Quran.
          </h1>
          <p className="text-ink-muted mt-3 max-w-prose text-sm leading-relaxed sm:text-base">
            A study-Bible-style index of{' '}
            {categories.reduce((s, c) => s + c.topics.length, 0).toString()} subjects across{' '}
            {categories.length.toString()} categories. Tap any topic to read every verse that
            addresses it — across surahs, in mushaf order.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {categories.length === 0 ? (
          <EmptyState
            title="Topics are preparing"
            hint="Thematic browsing is being readied — please check back in a moment."
          />
        ) : (
          <div className="space-y-12">
            {categories.map((cat) => (
              <section key={cat.slug} aria-labelledby={`cat-${cat.slug}`}>
                <div className="border-hairline mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b pb-2">
                  <h2
                    id={`cat-${cat.slug}`}
                    className="font-display text-ink-strong text-xl tracking-tight sm:text-2xl"
                  >
                    {cat.nameEn}
                  </h2>
                  {cat.nameAr ? (
                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-leaf text-base sm:text-lg"
                      style={{ fontFamily: '"UthmanicHafs", serif', unicodeBidi: 'plaintext' }}
                    >
                      {cat.nameAr}
                    </p>
                  ) : null}
                </div>
                <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.topics.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/topics/${t.slug}`}
                        className="paper-card hover-rise block px-4 py-4 sm:px-5 sm:py-5"
                      >
                        <p className="font-display text-ink-strong text-base leading-tight sm:text-lg">
                          {t.nameEn}
                        </p>
                        {t.nameAr ? (
                          <p
                            dir="rtl"
                            lang="ar"
                            className="font-arabic text-ink-muted mt-1 text-sm"
                            style={{ unicodeBidi: 'plaintext' }}
                          >
                            {t.nameAr}
                          </p>
                        ) : null}
                        {t.summary ? (
                          <p className="text-ink-muted mt-2 line-clamp-2 text-xs leading-relaxed">
                            {t.summary}
                          </p>
                        ) : null}
                        <p className="smallcaps text-leaf mt-3 text-[10px] tracking-widest">
                          {t.verseCount.toString()} {t.verseCount === 1 ? 'verse' : 'verses'} →
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
