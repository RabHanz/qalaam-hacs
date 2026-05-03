/**
 * Surah reader. Wired to the backend (per DEV_CHECKLIST.md Phase 5).
 *
 * Uses RSC + a streaming `<Suspense>` boundary so the page shows skeleton
 * immediately and hydrates as data arrives. Per CLAUDE.md §11.3 design
 * non-negotiables: empty / loading / error states all in place.
 */

import { QalaamError } from '@qalaam/core';
import { AyahLine, BasmalaHeader, MushafPage } from '@qalaam/ui-quran';
import { Suspense } from 'react';

import { EmptyState } from '../../../components/EmptyState.js';
import { ErrorState } from '../../../components/ErrorState.js';
import { LoadingState } from '../../../components/LoadingState.js';
import { qalaamClient } from '../../../lib/qalaam-client.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ surah: string }>;
}

async function SurahBody({ surahNumber }: { readonly surahNumber: number }): Promise<ReactNode> {
  let response: Awaited<ReturnType<typeof qalaamClient.getSurahVerses>>;
  try {
    response = await qalaamClient.getSurahVerses(surahNumber);
  } catch (err) {
    if (err instanceof QalaamError && err.code === 'qalaam.data.not-loaded') {
      return (
        <EmptyState
          title="Quran data not yet downloaded"
          hint="Run `make data-fetch` from the repo root to download the QUL data substrate (per ADR-0002), or this surah hasn't been bundled in the v0.1 fixture set yet."
        />
      );
    }
    return (
      <ErrorState
        title="Couldn't load this surah"
        message={err instanceof Error ? err.message : String(err)}
      />
    );
  }

  const ayahs = response.verses.map((v) => ({
    verseKey: v.verseKey,
    ayahNumber: v.ayah,
    words: v.textUthmani.split(/\s+/).map((w, i) => ({ index: i, arabic: w })),
  }));

  if (surahNumber === 1) {
    // Al-Fatiha fits on one mushaf page; use the page-faithful renderer.
    return (
      <MushafPage
        pageNumber={1}
        surahNumber={1}
        showBasmala={false /* Al-Fatiha contains the bismillah as ayah 1 */}
        ayahs={ayahs}
      />
    );
  }

  return (
    <section>
      <BasmalaHeader surahNumber={surahNumber} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {ayahs.map((a) => (
          <AyahLine key={a.verseKey} {...a} />
        ))}
      </div>
    </section>
  );
}

export default async function ReadSurahPage({ params }: PageProps): Promise<ReactNode> {
  const { surah } = await params;
  const surahNumber = Number.parseInt(surah, 10);
  if (!Number.isFinite(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState
          title="Surah not found"
          hint={`Surah index must be between 1 and 114. Got "${surah}".`}
        />
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Surah {surahNumber}</h1>
        <p className="text-sm opacity-70">Backed by Qalaam backend → QUL/fixture</p>
      </header>
      <Suspense fallback={<LoadingState label="Loading surah…" lines={8} />}>
        <SurahBody surahNumber={surahNumber} />
      </Suspense>
    </div>
  );
}
