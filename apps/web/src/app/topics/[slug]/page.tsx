/**
 * /topics/[slug] — topic detail page. Hero with topic name + summary,
 * then a vertically-stacked list of every verse on the subject. Each
 * verse card shows verse_key + Arabic + first-pass translation
 * (Pickthall public-domain) so the reader can scan the topic at a
 * glance, and tap into /study for the full deep-dive.
 */
import Link from 'next/link';

import { EmptyState } from '../../../components/EmptyState.js';
import { SiteNav } from '../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ slug: string }>;
}

interface ApiTopic {
  readonly slug: string;
  readonly nameEn: string;
  readonly nameAr: string | null;
  readonly summary: string | null;
  readonly verseCount: number;
  readonly verses: readonly string[];
}

interface VerseRow {
  readonly verseKey: string;
  readonly textUthmani: string;
}

export default async function TopicPage({ params }: PageProps): Promise<ReactNode> {
  const { slug } = await params;
  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';

  let topic: ApiTopic | null = null;
  try {
    const res = await fetch(`${apiBase}/v1/topics/${encodeURIComponent(slug)}`, {
      next: { revalidate: 86400 },
    });
    if (res.ok) topic = (await res.json()) as ApiTopic;
  } catch {
    /* ignore */
  }
  if (!topic) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Topic not found" hint={`Slug "${slug}".`} />
        </div>
      </>
    );
  }

  // Pull verse text + Pickthall translation in parallel for each verse.
  const [versesBody, translationsBody] = await Promise.all([
    Promise.all(
      topic.verses.map((vk) =>
        fetch(`${apiBase}/v1/verses/by_key/${encodeURIComponent(vk)}`, {
          next: { revalidate: 604800 },
        })
          .then((r) => (r.ok ? (r.json() as Promise<VerseRow>) : null))
          .catch(() => null),
      ),
    ),
    Promise.all(
      topic.verses.map((vk) =>
        fetch(`${apiBase}/v1/translations/pickthall/by_verse/${encodeURIComponent(vk)}`, {
          next: { revalidate: 604800 },
        })
          .then((r) => (r.ok ? (r.json() as Promise<{ text: string }>) : null))
          .catch(() => null),
      ),
    ),
  ]);

  return (
    <>
      <SiteNav />
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">
            <Link href="/topics" className="hover:text-ink">
              ← Topical index
            </Link>
          </p>
          <h1 className="font-display mt-3 text-3xl sm:text-5xl font-light tracking-tight text-ink-strong">
            {topic.nameEn.replace(/ · .*$/, '')}
          </h1>
          {topic.nameAr ? (
            <p
              dir="rtl"
              lang="ar"
              className="mt-2 text-2xl sm:text-3xl text-leaf"
              style={{ fontFamily: '"UthmanicHafs", "Amiri Quran", serif', unicodeBidi: 'plaintext' }}
            >
              {topic.nameAr}
            </p>
          ) : null}
          {topic.summary ? (
            <p className="mt-4 max-w-prose text-sm sm:text-base text-ink-muted leading-relaxed">
              {topic.summary}
            </p>
          ) : null}
          <p className="mt-3 smallcaps text-leaf text-[11px] tracking-widest">
            {topic.verseCount.toString()} {topic.verseCount === 1 ? 'verse' : 'verses'}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <ol className="list-none p-0 m-0 space-y-4 sm:space-y-6">
          {topic.verses.map((vk, i) => {
            const verse = versesBody[i];
            const tr = translationsBody[i];
            return (
              <li key={vk}>
                <Link href={`/study/${vk.replace(':', '/')}`} className="block paper-card-raised hover-rise p-5 sm:p-7">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="smallcaps font-mono text-[10px] tabular-nums text-ink-muted tracking-widest">
                      {vk}
                    </span>
                    <span className="smallcaps text-[10px] text-leaf tracking-widest">study →</span>
                  </div>
                  {verse ? (
                    <p
                      dir="rtl"
                      lang="ar"
                      className="text-ink-strong leading-[1.95] sm:leading-[2.05] mb-3 text-center"
                      style={{
                        fontFamily: '"UthmanicHafs", "Amiri Quran", serif',
                        fontSize: 'clamp(1.25rem, 0.9rem + 1.3vw, 1.85rem)',
                        unicodeBidi: 'plaintext',
                        fontWeight: 600,
                      }}
                    >
                      {verse.textUthmani}
                    </p>
                  ) : null}
                  {tr?.text ? (
                    <p
                      dir="ltr"
                      lang="en"
                      className="text-[15px] text-ink/85 leading-relaxed max-w-prose mx-auto text-start"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      {tr.text}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </main>
    </>
  );
}
