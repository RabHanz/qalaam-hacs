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
import { WordByWordPane } from '../../../../components/WordByWordPane.js';
import { qalaamClient } from '../../../../lib/qalaam-client.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ surah: string; ayah: string }>;
}

const TRANSLATIONS_TO_SHOW = ['pickthall', 'saheeh-international', 'clear-quran'] as const;
const TAFSIRS_TO_SHOW = ['muyassar', 'saheeh-footnotes'] as const;

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
      <div className="lg:col-span-9 reveal">
        {/* Hero Arabic verse with soft corner ornament */}
        <section
          aria-label={`Arabic text of ${verseKey}`}
          className="paper-card-raised relative overflow-hidden p-8 md:p-12"
        >
          <div
            className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, var(--color-leaf-300) 0%, transparent 70%)' }}
            aria-hidden
          />
          <div className="relative">
            <p className="smallcaps text-leaf text-xs">Verse · Āyah</p>
            <p className="font-mono mt-1 text-2xl tabular-nums text-ink-muted">{verseKey}</p>
            <p
              dir="rtl"
              className="font-arabic mt-6 text-3xl md:text-5xl text-ink-strong"
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
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display text-2xl font-light tracking-tight">Translations</h2>
            <span className="smallcaps text-leaf text-xs">
              {translations.length.toString()} renderings
            </span>
          </div>
          {translations.length === 0 ? (
            <p className="text-sm text-ink-muted italic">No translations bundled for this verse yet.</p>
          ) : (
            <ol className="grid gap-6 list-none p-0 m-0">
              {translations.map((t, i) => (
                <li key={t.slug} className={i > 0 ? 'pt-6 border-t border-hairline' : ''}>
                  <p className="font-display text-lg leading-[1.55] text-ink">
                    <span className="font-display text-leaf text-2xl mr-2 align-baseline" aria-hidden>
                      “
                    </span>
                    {t.text}
                    <span className="font-display text-leaf text-2xl ml-1 align-baseline" aria-hidden>
                      ”
                    </span>
                  </p>
                  <footer className="mt-3 text-xs smallcaps text-ink-muted">— {t.translatorName}</footer>
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
          <div className="flex items-baseline justify-between mb-6">
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
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display text-2xl font-light tracking-tight">Grammar</h2>
            <span className="smallcaps text-leaf text-xs">
              POS · lemma · root concordance
            </span>
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
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display text-2xl font-light tracking-tight">Tafsīr</h2>
            <span className="smallcaps text-leaf text-xs">
              {tafsirs.length.toString()} commentaries
            </span>
          </div>
          {tafsirs.length === 0 ? (
            <p className="text-sm text-ink-muted italic">No tafsir bundled for this verse yet.</p>
          ) : (
            <ol className="grid gap-8 list-none p-0 m-0">
              {tafsirs.map((t, i) => (
                <li key={t.slug} className={i > 0 ? 'pt-8 border-t border-hairline' : ''}>
                  <p
                    dir={t.language === 'ar' ? 'rtl' : 'ltr'}
                    className={
                      t.language === 'ar'
                        ? 'font-arabic text-xl leading-[1.95] text-ink'
                        : 'text-base leading-[1.7] text-ink'
                    }
                    style={{ unicodeBidi: 'plaintext' }}
                  >
                    {t.text}
                  </p>
                  <footer className="mt-4 text-xs smallcaps text-ink-muted">— {t.scholarName}</footer>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* SIDEBAR — mutashabihat watchlist as marginalia */}
      <aside className="lg:col-span-3 reveal reveal-2">
        <div className="lg:sticky lg:top-24 space-y-4">
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
                className="text-ink-muted hover:text-leaf transition-colors mt-2"
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
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="smallcaps text-leaf text-xs">Deep study · دِرَاسَة</p>
          <h1 className="font-display mt-3 text-4xl md:text-5xl font-light tracking-tight">
            {surahNumber.toString()}
            <span className="text-leaf">:</span>
            {ayahNumber.toString()}
          </h1>
          <p className="mt-3 text-sm text-ink-muted">
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
