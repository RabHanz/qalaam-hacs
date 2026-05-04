/**
 * /read/[surah] — Quranly-style ayah-by-ayah reader.
 *
 * Layout: editorial running header (English + Arabic surah name + meta) →
 * sticky ReaderControls (translation chip group + reciter chip group) →
 * vertical stack of AyahCards.
 *
 * Mobile-first: 16px gutters at <640px, 24px at sm, 64px at md+. Sticky
 * controls collapse padding on mobile. AyahCard scrolls action chips
 * horizontally when the viewport can't fit them.
 *
 * Translation/reciter come from URL `?t=...&r=...` (parsed server-side
 * via `searchParams`) and persist to localStorage on the client.
 *
 * Per CLAUDE.md adab: no XP, no streak, no scoreboard, no surveillance.
 * The reader is dignified — Arabic centered, generous breathing room,
 * embedded Arabic ayah numerals (no forced rosettes; the layout DB has
 * the canonical numbering glyph in-line with the words).
 */
import { QalaamError } from '@qalaam/core';
import Link from 'next/link';

import { AyahCard } from '../../../components/AyahCard.js';
import { EmptyState } from '../../../components/EmptyState.js';
import { ErrorState } from '../../../components/ErrorState.js';
import { LoadingState } from '../../../components/LoadingState.js';
import { ReaderControls } from '../../../components/ReaderControls.js';
import { SiteNav } from '../../../components/SiteNav.js';
import { qalaamClient } from '../../../lib/qalaam-client.js';

import { Suspense } from 'react';
import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ surah: string }>;
  readonly searchParams: Promise<{ t?: string; r?: string }>;
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

async function fetchSurahMeta(baseUrl: string, surah: number): Promise<SurahMeta | null> {
  const body = await fetchJson<{ data: SurahMeta }>(
    `${baseUrl}/v1/metadata/surahs/${surah.toString()}`,
  );
  return body?.data ?? null;
}

async function fetchTranslations(baseUrl: string): Promise<readonly TranslationItem[]> {
  const body = await fetchJson<{ translations: TranslationItem[] }>(`${baseUrl}/v1/translations`);
  return (body?.translations ?? []).filter((t) => t.language === 'en');
}

async function fetchReciters(baseUrl: string): Promise<readonly ReciterItem[]> {
  const body = await fetchJson<{ reciters: ReciterItem[] }>(`${baseUrl}/v1/reciters`);
  return body?.reciters ?? [];
}

async function fetchTranslationVerses(
  baseUrl: string,
  slug: string,
  surah: number,
  verseCount: number,
): Promise<Map<string, string>> {
  // Hits backend per-verse — backend returns from SQLite in <1ms; the cost
  // is mostly fetch overhead. Concurrency-limit to 16 in flight at once.
  const out = new Map<string, string>();
  if (slug === 'none' || verseCount === 0) return out;
  const verseKeys = Array.from({ length: verseCount }, (_, i) => `${surah.toString()}:${(i + 1).toString()}`);
  const CHUNK = 16;
  for (let i = 0; i < verseKeys.length; i += CHUNK) {
    const slice = verseKeys.slice(i, i + CHUNK);
    await Promise.all(
      slice.map(async (vk) => {
        const r = await fetchJson<{ text: string }>(
          `${baseUrl}/v1/translations/${slug}/by_verse/${encodeURIComponent(vk)}`,
          604800,
        );
        if (r?.text) out.set(vk, r.text);
      }),
    );
  }
  return out;
}

async function ReaderBody({
  surahNumber,
  meta,
  translationSlug,
  reciterSlug,
  apiBase,
  translatorAttribution,
}: {
  surahNumber: number;
  meta: SurahMeta | null;
  translationSlug: string;
  reciterSlug: string;
  apiBase: string;
  translatorAttribution: string | null;
}): Promise<ReactNode> {
  let response;
  try {
    response = await qalaamClient.getSurahVerses(surahNumber);
  } catch (err) {
    if (err instanceof QalaamError && err.code === 'qalaam.data.not-loaded') {
      return (
        <EmptyState
          title="Quran data not yet downloaded"
          hint="Run `make data-fetch` from the repo root to download the QUL data substrate (per ADR-0002)."
        />
      );
    }
    return <ErrorState message={err instanceof Error ? err.message : String(err)} />;
  }

  if (response.verses.length === 0) {
    return (
      <EmptyState
        title="No verses returned"
        hint="The backend returned an empty list. Confirm /v1/chapters/:id/verses is wired."
      />
    );
  }

  const verseCount = meta?.verseCount ?? response.verses.length;
  const translationMap =
    translationSlug && translationSlug !== 'none'
      ? await fetchTranslationVerses(apiBase, translationSlug, surahNumber, verseCount)
      : new Map<string, string>();

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Bismillah header (skip surah 9) */}
      {surahNumber !== 9 && meta?.bismillahPre !== 0 ? (
        <div className="text-center py-6 sm:py-10">
          <div className="rule-hairline mx-auto max-w-xs" />
          <p
            dir="rtl"
            className="font-arabic mt-6 text-3xl sm:text-4xl md:text-5xl text-ink-strong leading-[1.8]"
            style={{ unicodeBidi: 'plaintext', fontWeight: 600 }}
            aria-label="Bismillah"
          >
            {BASMALA}
          </p>
          <div className="rule-hairline mx-auto max-w-xs mt-6" />
        </div>
      ) : null}

      {response.verses.map((v) => (
        <AyahCard
          key={v.verseKey}
          verseKey={v.verseKey}
          arabic={v.textUthmani}
          translation={translationMap.get(v.verseKey) ?? null}
          translationSlug={translationSlug === 'none' ? null : translationSlug}
          translatorAttribution={translatorAttribution}
          reciterSlug={reciterSlug}
          apiBase={apiBase}
        />
      ))}
    </div>
  );
}

export default async function ReadSurahPage({
  params,
  searchParams,
}: PageProps): Promise<ReactNode> {
  const [{ surah }, sp] = await Promise.all([params, searchParams]);
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
  const [meta, translations, reciters] = await Promise.all([
    fetchSurahMeta(apiBase, surahNumber),
    fetchTranslations(apiBase),
    fetchReciters(apiBase),
  ]);

  const translationSlug = sp.t ?? 'pickthall';
  const reciterSlug = sp.r ?? 'sudais';

  const translator =
    translationSlug !== 'none'
      ? translations.find((t) => t.slug === translationSlug)?.translator ?? null
      : null;

  return (
    <>
      <SiteNav />

      {/* Editorial running header — mobile-first */}
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-5xl items-end justify-between gap-4 px-4 sm:px-6 py-6 sm:py-10">
          <div className="min-w-0">
            <p className="smallcaps text-leaf text-[11px] tracking-widest">Sūrat</p>
            <h1 className="font-display mt-1.5 text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-ink-strong truncate">
              {meta?.nameEnglish ?? `Surah ${surahNumber.toString()}`}
            </h1>
            {meta ? (
              <p className="mt-1.5 text-xs sm:text-sm text-ink-muted">
                <span className="font-mono tabular-nums">
                  {surahNumber.toString().padStart(3, '0')}
                </span>
                {' · '}
                {meta.verseCount.toString()} verses · {meta.revelationPlace}
              </p>
            ) : null}
          </div>
          <p
            dir="rtl"
            className="font-arabic text-4xl sm:text-5xl md:text-6xl text-ink-strong shrink-0"
            style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
          >
            {meta?.nameArabic ?? ''}
          </p>
        </div>
      </header>

      <ReaderControls
        translations={translations}
        reciters={reciters}
        defaultTranslation="pickthall"
        defaultReciter="sudais"
      />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        <Suspense fallback={<LoadingState label="Loading surah…" lines={8} />}>
          <ReaderBody
            surahNumber={surahNumber}
            meta={meta}
            translationSlug={translationSlug}
            reciterSlug={reciterSlug}
            apiBase={apiBase}
            translatorAttribution={translator}
          />
        </Suspense>

        <nav
          aria-label="Surah navigation"
          className="flex items-baseline justify-between text-sm pt-12 mt-12 border-t border-hairline"
        >
          {surahNumber > 1 ? (
            <Link
              href={`/read/${(surahNumber - 1).toString()}`}
              className="smallcaps text-ink-muted hover:text-leaf"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {surahNumber < 114 ? (
            <Link
              href={`/read/${(surahNumber + 1).toString()}`}
              className="smallcaps text-ink-muted hover:text-leaf"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>
    </>
  );
}
