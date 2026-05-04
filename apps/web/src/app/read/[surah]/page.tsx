/**
 * /read/[surah] — Quranly-style reader.
 *
 * Server component fetches surah meta + verses + translations + reciters +
 * available layouts, then hands the lot to the single client island
 * `ReadSurfaceClient` which owns all interactive state (translation, reciter,
 * layout, view mode, single-ayah index). This unifies the data flow and
 * fixes the hydration mismatch that was happening when state was split
 * between a server component and a client island reading URL params.
 */
import { QalaamError } from '@qalaam/core';

import { EmptyState } from '../../../components/EmptyState.js';
import { ErrorState } from '../../../components/ErrorState.js';
import { ReadSurfaceClient, type VerseLite } from '../../../components/ReadSurfaceClient.js';
import { SiteNav } from '../../../components/SiteNav.js';
import { qalaamClient } from '../../../lib/qalaam-client.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ surah: string }>;
}

interface SurahMeta {
  surah: number;
  nameArabic: string;
  nameEnglish: string;
  nameTransliteration: string;
  verseCount: number;
  revelationPlace: 'makkah' | 'madinah';
  bismillahPre: number;
}

interface TranslationItem {
  readonly slug: string;
  readonly name: string;
  readonly translator: string;
  readonly language: string;
}

interface ReciterItem {
  readonly id: string;
  readonly slug: string;
  readonly name: { en: string; ar: string };
  readonly style: string;
}

interface LayoutItem {
  readonly slug: string;
  readonly name: string;
  readonly subtitle?: string;
}

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

async function fetchJson<T>(url: string, revalidate = 86400): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function ReadSurahPage({ params }: PageProps): Promise<ReactNode> {
  const { surah } = await params;
  const surahNumber = Number.parseInt(surah, 10);
  if (!Number.isFinite(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20">
          <EmptyState
            title="Surah not found"
            hint={`Surah index must be between 1 and 114. Got "${surah}".`}
          />
        </div>
      </>
    );
  }

  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';

  let response;
  try {
    response = await qalaamClient.getSurahVerses(surahNumber);
  } catch (err) {
    if (err instanceof QalaamError && err.code === 'qalaam.data.not-loaded') {
      return (
        <>
          <SiteNav />
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20">
            <EmptyState
              title="Quran data not yet downloaded"
              hint="Run `make data-fetch` from the repo root to download the QUL data substrate."
            />
          </div>
        </>
      );
    }
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20">
          <ErrorState message={err instanceof Error ? err.message : String(err)} />
        </div>
      </>
    );
  }

  const verses: readonly VerseLite[] = response.verses.map((v) => ({
    verseKey: v.verseKey,
    textUthmani: v.textUthmani,
  }));

  const [meta, translationsBody, recitersBody, layoutsBody] = await Promise.all([
    fetchJson<{ data: SurahMeta }>(`${apiBase}/v1/metadata/surahs/${surahNumber.toString()}`),
    fetchJson<{ translations: TranslationItem[] }>(`${apiBase}/v1/translations`),
    fetchJson<{ reciters: ReciterItem[] }>(`${apiBase}/v1/reciters`),
    fetchJson<{ layouts?: LayoutItem[]; data?: string[] }>(`${apiBase}/v1/layouts`),
  ]);

  // SSR-prefetch the default translation so the page renders complete on
  // first paint. (Client side, it lazy-fetches when the user picks a
  // different translation.)
  const defaultT = 'pickthall';
  const prefetchedTranslation: Record<string, string> = {};
  try {
    const fetched = await Promise.all(
      verses.map((v) =>
        fetchJson<{ text: string }>(
          `${apiBase}/v1/translations/${defaultT}/by_verse/${encodeURIComponent(v.verseKey)}`,
          604800,
        ),
      ),
    );
    fetched.forEach((row, i) => {
      if (row?.text && verses[i]) prefetchedTranslation[verses[i].verseKey] = row.text;
    });
  } catch {
    /* ignore — client will refetch */
  }

  const surahMeta = meta?.data ?? null;
  const translations = (translationsBody?.translations ?? []).filter((t) => t.language === 'en');
  const reciters = recitersBody?.reciters ?? [];
  const layouts =
    layoutsBody?.layouts ??
    (layoutsBody?.data ?? []).map((slug) => ({ slug, name: slug }));

  return (
    <>
      <SiteNav />

      {/* Editorial running header */}
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-5xl items-end justify-between gap-4 px-4 sm:px-6 py-6 sm:py-10">
          <div className="min-w-0">
            <p className="smallcaps text-leaf text-[11px] tracking-widest">Sūrat</p>
            <h1 className="font-display mt-1.5 text-2xl sm:text-4xl md:text-5xl font-light tracking-tight text-ink-strong truncate">
              {surahMeta?.nameEnglish ?? `Surah ${surahNumber.toString()}`}
            </h1>
            {surahMeta ? (
              <p className="mt-1.5 text-[11px] sm:text-sm text-ink-muted">
                <span className="font-mono tabular-nums">
                  {surahNumber.toString().padStart(3, '0')}
                </span>
                {' · '}
                {surahMeta.verseCount.toString()} verses · {surahMeta.revelationPlace}
              </p>
            ) : null}
          </div>
          <p
            dir="rtl"
            lang="ar"
            className="font-arabic text-3xl sm:text-5xl md:text-6xl text-ink-strong shrink-0"
            style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
          >
            {surahMeta?.nameArabic ?? ''}
          </p>
        </div>
      </header>

      {/* Bismillah header (skip surah 9). Rendered server-side, hydration-safe. */}
      {surahNumber !== 9 && surahMeta?.bismillahPre !== 0 ? (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center py-6 sm:py-10">
          <div className="rule-hairline mx-auto max-w-xs" />
          <p
            dir="rtl"
            lang="ar"
            className="font-arabic mt-5 sm:mt-6 text-2xl sm:text-4xl md:text-5xl text-ink-strong leading-[1.8]"
            style={{ unicodeBidi: 'plaintext', fontWeight: 600 }}
            aria-label="Bismillah"
          >
            {BASMALA}
          </p>
          <div className="rule-hairline mx-auto max-w-xs mt-5 sm:mt-6" />
        </div>
      ) : null}

      <ReadSurfaceClient
        apiBase={apiBase}
        verses={verses}
        translations={translations}
        reciters={reciters}
        layouts={layouts}
        tafsirSlug="muyassar"
        defaultTranslation={defaultT}
        defaultReciter="sudais"
        defaultLayout={layouts[0]?.slug ?? 'madani_15'}
        prefetchedTranslation={prefetchedTranslation}
      />
    </>
  );
}
