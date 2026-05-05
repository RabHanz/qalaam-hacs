/**
 * /study/[surah]/[ayah] — deep-study reader (editorial spread).
 *
 * Design intent: looks like an annotated study Bible page, not a SaaS
 * dashboard. Hero Arabic verse floats large with a soft gold-radial
 * corner ornament; translations stack with hanging quote marks; tafsir
 * gets its own card; mutashabihat watch sticks in the right rail like
 * marginalia in a critical edition.
 */
import { QalaamError, parseVerseKey } from '@qalaam/core';
import { Suspense } from 'react';

import { EmptyState } from '../../../../components/EmptyState.js';
import { ErrorState } from '../../../../components/ErrorState.js';
import { HairlineDivider } from '../../../../components/Glyph.js';
import { LoadingState } from '../../../../components/LoadingState.js';
import { MorphologyPane } from '../../../../components/MorphologyPane.js';
import { MutashabihatWatchlistPane } from '../../../../components/MutashabihatWatchlistPane.js';
import { SiteNav } from '../../../../components/SiteNav.js';
import { SurahInfoPane } from '../../../../components/SurahInfoPane.js';
import { TopicsByVersePane } from '../../../../components/TopicsByVersePane.js';
import { WordByWordPane } from '../../../../components/WordByWordPane.js';
import { qalaamClient } from '../../../../lib/qalaam-client.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ surah: string; ayah: string }>;
}

// Default panes shown above the fold. The picker (TafsirsPanel below)
// surfaces all 7 ingested tafsirs and lets the user toggle others.
const TRANSLATIONS_TO_SHOW = ['pickthall', 'saheeh-international', 'maududi'] as const;
const TAFSIRS_TO_SHOW = [
  'muyassar',
  'ibn-kathir',
  'jalalayn',
  'qurtubi',
  'baghawi',
  'miqbas',
  'waseet',
] as const;

async function StudyBody({
  surahNumber,
  ayahNumber,
}: {
  readonly surahNumber: number;
  readonly ayahNumber: number;
}): Promise<ReactNode> {
  const verseKey = parseVerseKey(`${surahNumber.toString()}:${ayahNumber.toString()}`);

  let arabic: string;
  try {
    const verse = await qalaamClient.getVerseByKey(verseKey);
    arabic = verse.textUthmani;
  } catch (err) {
    if (err instanceof QalaamError && err.code === 'qalaam.data.not-loaded') {
      return (
        <EmptyState
          title="Verse not yet ingested"
          hint="Run scripts/data/scrape-qul.sh to pull the full Quran from QUL."
        />
      );
    }
    return <ErrorState message={err instanceof Error ? err.message : String(err)} />;
  }

  const [translationListRes, tafsirListRes, ...verseFetches] = await Promise.allSettled([
    qalaamClient.listTranslations(),
    qalaamClient.listTafsirs(),
    ...TRANSLATIONS_TO_SHOW.map((slug) => qalaamClient.getTranslationVerse(slug, verseKey)),
    ...TAFSIRS_TO_SHOW.map((slug) => qalaamClient.getTafsirVerse(slug, verseKey)),
  ]);

  const translationList =
    translationListRes.status === 'fulfilled' ? translationListRes.value.translations : [];
  const tafsirList = tafsirListRes.status === 'fulfilled' ? tafsirListRes.value.tafsirs : [];

  const trVerseFetches = verseFetches.slice(0, TRANSLATIONS_TO_SHOW.length);
  const tafsirVerseFetches = verseFetches.slice(TRANSLATIONS_TO_SHOW.length);

  const translations = TRANSLATIONS_TO_SHOW.flatMap((slug, i) => {
    const f = trVerseFetches[i];
    if (f?.status !== 'fulfilled') return [];
    const meta = translationList.find((t) => t.slug === slug);
    return [
      {
        slug,
        translatorName: meta?.translator ?? slug,
        text: (f.value as { text: string }).text,
      },
    ];
  });

  const tafsirs = TAFSIRS_TO_SHOW.flatMap((slug, i) => {
    const f = tafsirVerseFetches[i];
    if (f?.status !== 'fulfilled') return [];
    const meta = tafsirList.find((t) => t.slug === slug);
    return [
      {
        slug,
        scholarName: meta?.scholar ?? slug,
        language: meta?.language ?? 'en',
        text: (f.value as { text: string }).text,
      },
    ];
  });

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
      <div className="reveal lg:col-span-9">
        {/* Hero Arabic verse with soft corner ornament */}
        <section
          aria-label={`Arabic text of ${verseKey}`}
          className="paper-card-raised relative overflow-hidden p-8 md:p-12"
        >
          <div
            className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-25"
            style={{
              background: 'radial-gradient(circle, var(--color-leaf-300) 0%, transparent 70%)',
            }}
            aria-hidden
          />
          <div className="relative">
            <p className="smallcaps text-leaf text-xs">Verse · Āyah</p>
            <p className="text-ink-muted mt-1 font-mono text-2xl tabular-nums">{verseKey}</p>
            <p
              dir="rtl"
              className="font-arabic text-ink-strong mt-6 text-3xl md:text-5xl"
              style={{ lineHeight: 1.9, unicodeBidi: 'plaintext', textAlign: 'right' }}
            >
              {arabic}
            </p>
          </div>
        </section>

        {/* Translations stack */}
        <section
          aria-label={`Translations of ${verseKey}`}
          className="paper-card-raised mt-6 p-8 md:p-10"
        >
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-light tracking-tight">Translations</h2>
            <span className="smallcaps text-leaf text-xs">
              {translations.length.toString()} renderings
            </span>
          </div>
          {translations.length === 0 ? (
            <p className="text-ink-muted text-sm italic">
              No translations bundled for this verse yet.
            </p>
          ) : (
            <ol className="m-0 grid list-none gap-6 p-0">
              {translations.map((t, i) => (
                <li key={t.slug} className={i > 0 ? 'border-hairline border-t pt-6' : ''}>
                  <p className="font-display text-ink text-lg leading-[1.55]">
                    <span
                      className="font-display text-leaf mr-2 align-baseline text-2xl"
                      aria-hidden
                    >
                      “
                    </span>
                    {t.text}
                    <span
                      className="font-display text-leaf ml-1 align-baseline text-2xl"
                      aria-hidden
                    >
                      ”
                    </span>
                  </p>
                  <footer className="smallcaps text-ink-muted mt-3 text-xs">
                    — {t.translatorName}
                  </footer>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Word-by-word — gloss only */}
        <section
          className="paper-card-raised mt-6 p-8 md:p-10"
          aria-label={`Word by word for ${verseKey}`}
        >
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-light tracking-tight">Word-by-word</h2>
            <span className="smallcaps text-leaf text-xs">QUL · English</span>
          </div>
          <Suspense fallback={<LoadingState label="Loading word-by-word…" lines={3} />}>
            <WordByWordPane verseKey={verseKey} />
          </Suspense>
        </section>

        {/* Grammatical morphology — POS / lemma / root */}
        <section
          className="paper-card-raised mt-6 p-8 md:p-10"
          aria-label={`Morphology of ${verseKey}`}
        >
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-light tracking-tight">Grammar</h2>
            <span className="smallcaps text-leaf text-xs">POS · lemma · root concordance</span>
          </div>
          <Suspense fallback={<LoadingState label="Loading morphology…" lines={3} />}>
            <MorphologyPane verseKey={verseKey} />
          </Suspense>
        </section>

        {/* Tafsir */}
        <section
          className="paper-card-raised mt-6 p-8 md:p-10"
          aria-label={`Tafsir of ${verseKey}`}
        >
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-light tracking-tight">Tafsīr</h2>
            <span className="smallcaps text-leaf text-xs">
              {tafsirs.length.toString()} commentaries
            </span>
          </div>
          {tafsirs.length === 0 ? (
            <p className="text-ink-muted text-sm italic">No tafsir bundled for this verse yet.</p>
          ) : (
            <ol className="m-0 grid list-none gap-8 p-0">
              {tafsirs.map((t, i) => (
                <li key={t.slug} className={i > 0 ? 'border-hairline border-t pt-8' : ''}>
                  <p
                    dir={t.language === 'ar' ? 'rtl' : 'ltr'}
                    className={
                      t.language === 'ar'
                        ? 'font-arabic text-ink text-xl leading-[1.95]'
                        : 'text-ink text-base leading-[1.7]'
                    }
                    style={{ unicodeBidi: 'plaintext' }}
                  >
                    {t.text}
                  </p>
                  <footer className="smallcaps text-ink-muted mt-4 text-xs">
                    — {t.scholarName}
                  </footer>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* SIDEBAR — mutashabihat watchlist as marginalia */}
      <aside className="reveal reveal-2 lg:col-span-3">
        <div className="space-y-4 lg:sticky lg:top-24">
          <Suspense fallback={null}>
            <TopicsByVersePane verseKey={verseKey} />
          </Suspense>
          <Suspense fallback={null}>
            <SurahInfoPane
              variant="expanded"
              surah={surahNumber}
              apiBase={process.env.PUBLIC_API_URL ?? 'http://localhost:4111'}
            />
          </Suspense>
          <Suspense fallback={null}>
            <MutashabihatWatchlistPane verseKey={verseKey} limit={5} />
          </Suspense>
          <div className="paper-card p-5">
            <p className="smallcaps text-leaf text-xs">Quick navigation</p>
            <div className="mt-3 grid gap-2 text-sm">
              {ayahNumber > 1 ? (
                <a
                  href={`/study/${surahNumber.toString()}/${(ayahNumber - 1).toString()}`}
                  className="text-ink-muted hover:text-leaf transition-colors"
                >
                  ← Previous verse
                </a>
              ) : null}
              <a
                href={`/study/${surahNumber.toString()}/${(ayahNumber + 1).toString()}`}
                className="text-ink-muted hover:text-leaf transition-colors"
              >
                Next verse →
              </a>
              <a
                href={`/read/${surahNumber.toString()}`}
                className="text-ink-muted hover:text-leaf mt-2 transition-colors"
              >
                Read full surah
              </a>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// OG metadata — produces the <meta property="og:image"> + Twitter card
// pointing at our Satori-rendered ayah card so social shares render
// the verse instead of a generic Qalaam preview.
export async function generateMetadata({ params }: PageProps): Promise<{
  title: string;
  description: string;
  openGraph: { title: string; description: string; images: string[]; type: 'article' };
  twitter: { card: 'summary_large_image'; title: string; description: string; images: string[] };
}> {
  const { surah, ayah } = await params;
  const verseKey = `${surah}:${ayah}`;
  const ogUrl = `/og/ayah/${encodeURIComponent(verseKey)}`;
  const title = `${verseKey} · Qalaam`;
  const description = `Read, listen, and study verse ${verseKey} of the Holy Quran with translations, tafsir, and word-by-word grammar.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogUrl],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function StudyPage({ params }: PageProps): Promise<ReactNode> {
  const { surah, ayah } = await params;
  const surahNumber = Number.parseInt(surah, 10);
  const ayahNumber = Number.parseInt(ayah, 10);
  if (
    !Number.isFinite(surahNumber) ||
    surahNumber < 1 ||
    surahNumber > 114 ||
    !Number.isFinite(ayahNumber) ||
    ayahNumber < 1
  ) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl p-6 py-20">
          <EmptyState title="Invalid verse reference" hint={`Got "${surah}:${ayah}".`} />
        </div>
      </>
    );
  }
  return (
    <>
      <SiteNav />
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="smallcaps text-leaf text-xs">Deep study · دِرَاسَة</p>
          <h1 className="font-display mt-3 text-4xl font-light tracking-tight md:text-5xl">
            {surahNumber.toString()}
            <span className="text-leaf">:</span>
            {ayahNumber.toString()}
          </h1>
          <p className="text-ink-muted mt-3 text-sm">
            Arabic · translations · word-by-word · tafsīr · mutashabihat watchlist
          </p>
          <HairlineDivider />
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <Suspense
          fallback={<LoadingState label="Loading verse, translations, and tafsir…" lines={10} />}
        >
          <StudyBody surahNumber={surahNumber} ayahNumber={ayahNumber} />
        </Suspense>
      </div>
    </>
  );
}
