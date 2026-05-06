/**
 * /search — diacritics-insensitive cross-corpus search.
 *
 * Three editorial sections, ranked by FTS5 BM25:
 *   1. Topics ribbon (highest signal — curated taxonomy)
 *   2. Verses (Arabic text matches)
 *   3. Translations (gloss matches across 28 languages)
 *
 * Backed by /v1/search. Design borrows from Wikipedia's editorial
 * search-results layout: dense, scan-friendly, hairline-divided, with
 * marked highlight runs preserved as <mark> from the FTS5 snippet().
 */
import Link from 'next/link';

import { EmptyState } from '../../components/EmptyState.js';
import { HighlightedSnippet } from '../../components/HighlightedSnippet.js';
import { SearchInput } from '../../components/SearchInput.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly searchParams: Promise<{ q?: string; lang?: string }>;
}

interface SearchResponse {
  readonly query: string;
  readonly lang: string | null;
  readonly verses: readonly {
    readonly verseKey: string;
    readonly surah: number;
    readonly ayah: number;
    readonly text: string;
    readonly snippet: string;
    readonly score: number;
  }[];
  readonly translations: readonly {
    readonly verseKey: string;
    readonly slug: string;
    readonly language: string | null;
    readonly text: string;
    readonly snippet: string;
    readonly score: number;
  }[];
  readonly topics: readonly {
    readonly slug: string;
    readonly nameEn: string;
    readonly nameAr: string | null;
    readonly summary: string | null;
    readonly snippet: string;
    readonly score: number;
  }[];
  readonly totalMatches: number;
}

// Always render per-request — the backend is on the Docker network at
// http://qalaam-backend:4111 and ISN'T running during `next build`,
// so static generation would bake empty/null data. Per-request
// rendering hits the live backend each time.
export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: PageProps): Promise<ReactNode> {
  const { q = '', lang } = await searchParams;
  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';

  let body: SearchResponse | null = null;
  if (q.trim().length > 0) {
    try {
      const url = new URL(`${apiBase}/v1/search`);
      url.searchParams.set('q', q);
      if (lang) url.searchParams.set('lang', lang);
      const res = await fetch(url.toString(), { next: { revalidate: 60 } });
      if (res.ok) body = (await res.json()) as SearchResponse;
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <SiteNav />

      <header className="border-hairline border-b">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Search · بحث</p>
          <h1 className="font-display text-ink-strong mt-2 text-3xl font-light tracking-tight sm:text-5xl">
            {q.trim() ? `“${q.trim()}”` : 'Quran search'}
          </h1>
          <p className="text-ink-muted mt-2 max-w-prose text-sm leading-relaxed sm:text-base">
            Diacritics-insensitive across 6,236 verses · 367,924 translation rows · 53 topics.
          </p>
          <div className="mt-5">
            <SearchInput defaultValue={q} defaultLang={lang ?? ''} />
          </div>
          {body ? (
            <p className="smallcaps text-leaf mt-4 text-[11px] tracking-widest">
              {body.totalMatches.toString()} {body.totalMatches === 1 ? 'match' : 'matches'}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {!body || q.trim().length === 0 ? (
          <EmptyState
            title="What do you want to find?"
            hint="Try “mercy”, “patience”, “the orphans”, “1:5”, or any Arabic phrase."
          />
        ) : body.totalMatches === 0 ? (
          <EmptyState
            title="No matches"
            hint={`Nothing for “${q}”. Try fewer or different words.`}
          />
        ) : (
          <div className="space-y-10">
            {/* Topics — small, dense, ribbon at the top */}
            {body.topics.length > 0 ? (
              <section aria-labelledby="search-topics">
                <div className="border-hairline mb-4 flex items-baseline justify-between border-b pb-2">
                  <h2
                    id="search-topics"
                    className="font-display text-ink-strong text-lg tracking-tight sm:text-xl"
                  >
                    Topics
                  </h2>
                  <p className="smallcaps text-ink-muted text-[10px] tracking-widest">
                    {body.topics.length.toString()}
                  </p>
                </div>
                <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                  {body.topics.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/topics/${t.slug}`}
                        className="paper-card hover-rise block px-4 py-3"
                      >
                        <p className="font-display text-ink-strong text-base">{t.nameEn}</p>
                        {t.nameAr ? (
                          <p
                            dir="rtl"
                            lang="ar"
                            className="font-arabic text-ink-muted mt-0.5 text-sm"
                            style={{ unicodeBidi: 'plaintext' }}
                          >
                            {t.nameAr}
                          </p>
                        ) : null}
                        {t.summary ? (
                          <HighlightedSnippet
                            className="text-ink-muted mt-1.5 line-clamp-2 block text-xs leading-relaxed"
                            text={t.snippet}
                            fallback={t.summary}
                          />
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Verses — Arabic-text matches */}
            {body.verses.length > 0 ? (
              <section aria-labelledby="search-verses">
                <div className="border-hairline mb-4 flex items-baseline justify-between border-b pb-2">
                  <h2
                    id="search-verses"
                    className="font-display text-ink-strong text-lg tracking-tight sm:text-xl"
                  >
                    Verses
                  </h2>
                  <p className="smallcaps text-ink-muted text-[10px] tracking-widest">
                    {body.verses.length.toString()}
                  </p>
                </div>
                <ol className="m-0 list-none space-y-3 p-0">
                  {body.verses.map((v) => (
                    <li key={v.verseKey}>
                      <Link
                        href={`/study/${v.surah.toString()}/${v.ayah.toString()}`}
                        className="paper-card hover-rise block px-5 py-4"
                      >
                        <div className="mb-2 flex items-baseline justify-between">
                          <span className="smallcaps text-ink-muted font-mono text-[10px] tabular-nums tracking-widest">
                            {v.verseKey}
                          </span>
                          <span className="smallcaps text-leaf text-[10px] tracking-widest">
                            study →
                          </span>
                        </div>
                        <p
                          dir="rtl"
                          lang="ar"
                          className="text-ink-strong mb-1 leading-[1.95]"
                          style={{
                            fontFamily: '"UthmanicHafs"',
                            fontSize: 'clamp(1.05rem, 0.85rem + 0.6vw, 1.35rem)',
                            unicodeBidi: 'plaintext',
                            fontWeight: 600,
                          }}
                        >
                          <HighlightedSnippet text={v.snippet} fallback={v.text} />
                        </p>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {/* Translations — language-tagged */}
            {body.translations.length > 0 ? (
              <section aria-labelledby="search-translations">
                <div className="border-hairline mb-4 flex items-baseline justify-between border-b pb-2">
                  <h2
                    id="search-translations"
                    className="font-display text-ink-strong text-lg tracking-tight sm:text-xl"
                  >
                    Translations
                  </h2>
                  <p className="smallcaps text-ink-muted text-[10px] tracking-widest">
                    {body.translations.length.toString()}
                    {body.lang ? ` · ${body.lang}` : null}
                  </p>
                </div>
                <ol className="m-0 list-none space-y-3 p-0">
                  {body.translations.map((t) => (
                    <li key={`${t.slug}-${t.verseKey}`}>
                      <Link
                        href={`/study/${t.verseKey.replace(':', '/')}`}
                        className="paper-card hover-rise block px-5 py-4"
                      >
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <span className="smallcaps text-ink-muted font-mono text-[10px] tabular-nums tracking-widest">
                            {t.verseKey}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="smallcaps text-ink-muted text-[9px] tracking-widest">
                              {t.slug}
                            </span>
                            {t.language ? (
                              <span className="bg-paper-200/60 smallcaps text-leaf rounded-full px-1.5 py-0.5 text-[9px] tracking-widest">
                                {t.language}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <HighlightedSnippet
                          className="text-ink/90 block text-[14px] leading-relaxed sm:text-[15px]"
                          text={t.snippet}
                          fallback={t.text}
                        />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        )}
      </main>
    </>
  );
}
