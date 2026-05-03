/**
 * /study/[surah]/[ayah] — 3-pane deep-study reader.
 *
 * Per strategy §11.3 + §21.4: Arabic + translations + tafsir together.
 *
 * v0.1: bundles Pickthall, Saheeh Intl, Clear Quran translations + Muyassar
 * Arabic tafsir + Saheeh footnotes for Al-Fatiha. v0.5 wires the full Quran
 * via QUL.
 */
import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { QalaamError, parseVerseKey } from '@qalaam/core';
import { DeepStudyPane } from '@qalaam/ui-quran';

import { EmptyState } from '../../../../components/EmptyState.js';
import { ErrorState } from '../../../../components/ErrorState.js';
import { LoadingState } from '../../../../components/LoadingState.js';
import { qalaamClient } from '../../../../lib/qalaam-client.js';

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
          title="Verse not bundled yet"
          hint="v0.1 ships Al-Fatiha (1:1 - 1:7) only. Run `make data-fetch` for full QUL coverage."
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
    if (!f || f.status !== 'fulfilled') return [];
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
    if (!f || f.status !== 'fulfilled') return [];
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
    <DeepStudyPane
      verseKey={verseKey}
      arabic={arabic}
      translations={translations}
      tafsirs={tafsirs}
    />
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
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState title="Invalid verse reference" hint={`Got "${surah}:${ayah}".`} />
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">
          Deep study — {surahNumber}:{ayahNumber}
        </h1>
        <p className="text-sm opacity-70">Arabic · translations · tafsir</p>
      </header>
      <Suspense fallback={<LoadingState label="Loading verse, translations, and tafsir…" lines={10} />}>
        {/* @ts-expect-error: server-component async */}
        <StudyBody surahNumber={surahNumber} ayahNumber={ayahNumber} />
      </Suspense>
    </div>
  );
}
