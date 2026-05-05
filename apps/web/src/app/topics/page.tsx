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
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Topical index · مواضيع</p>
          <h1 className="font-display mt-2 text-3xl sm:text-5xl md:text-6xl font-light tracking-tight text-ink-strong">
            Subjects of the Quran.
          </h1>
          <p className="mt-3 max-w-prose text-sm sm:text-base text-ink-muted leading-relaxed">
            A study-Bible-style index of {categories.reduce((s, c) => s + c.topics.length, 0).toString()}{' '}
            subjects across {categories.length.toString()} categories. Tap any topic to read every
            verse that addresses it — across surahs, in mushaf order.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        {categories.length === 0 ? (
          <EmptyState title="Topics not yet ingested" hint="Run scripts/data/ingest-topics.py" />
        ) : (
          <div className="space-y-12">
            {categories.map((cat) => (
              <section key={cat.slug} aria-labelledby={`cat-${cat.slug}`}>
                <div className="flex items-baseline justify-between border-b border-hairline pb-2 mb-5 gap-3 flex-wrap">
                  <h2
                    id={`cat-${cat.slug}`}
                    className="font-display text-xl sm:text-2xl text-ink-strong tracking-tight"
                  >
                    {cat.nameEn}
                  </h2>
                  {cat.nameAr ? (
                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-base sm:text-lg text-leaf"
                      style={{ fontFamily: '"UthmanicHafs", serif', unicodeBidi: 'plaintext' }}
                    >
                      {cat.nameAr}
                    </p>
                  ) : null}
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0">
                  {cat.topics.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/topics/${t.slug}`}
                        className="paper-card hover-rise block px-4 py-4 sm:px-5 sm:py-5"
                      >
                        <p className="font-display text-base sm:text-lg text-ink-strong leading-tight">
                          {t.nameEn}
                        </p>
                        {t.nameAr ? (
                          <p
                            dir="rtl"
                            lang="ar"
                            className="font-arabic text-sm text-ink-muted mt-1"
                            style={{ unicodeBidi: 'plaintext' }}
                          >
                            {t.nameAr}
                          </p>
                        ) : null}
                        {t.summary ? (
                          <p className="text-xs text-ink-muted mt-2 leading-relaxed line-clamp-2">
                            {t.summary}
                          </p>
                        ) : null}
                        <p className="mt-3 smallcaps text-[10px] text-leaf tracking-widest">
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
