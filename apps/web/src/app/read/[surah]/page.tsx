/**
 * Surah reader. Wired to the backend (per DEV_CHECKLIST.md Phase 5).
 *
 * Design intent: page-faithful mushaf reverence. Editorial running header
 * with surah Arabic name in display, page number top-right (mushaf
 * convention), Bismillah composed as a centered hairline-ruled header,
 * each verse with custom 8-pointed gold rosette as ayah-end glyph, and
 * the layout switcher rendered as a tasteful pill group.
 */
import { QalaamError } from '@qalaam/core';
import { Suspense } from 'react';

import { EmptyState } from '../../../components/EmptyState.js';
import { ErrorState } from '../../../components/ErrorState.js';
import { LayoutSwitcher } from '../../../components/LayoutSwitcher.js';
import { LoadingState } from '../../../components/LoadingState.js';
import { RosetteGlyph } from '../../../components/Glyph.js';
import { SiteNav } from '../../../components/SiteNav.js';
import { qalaamClient } from '../../../lib/qalaam-client.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ surah: string }>;
  readonly searchParams: Promise<{ layout?: string }>;
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

async function fetchLayouts(baseUrl: string): Promise<readonly string[]> {
  try {
    const res = await fetch(`${baseUrl}/v1/layouts`, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: string[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

async function fetchSurahMeta(baseUrl: string, surah: number): Promise<SurahMeta | null> {
  try {
    const res = await fetch(`${baseUrl}/v1/metadata/surahs/${surah.toString()}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: SurahMeta };
    return body.data;
  } catch {
    return null;
  }
}

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

function arabicNumeral(n: number): string {
  return n
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
    .join('');
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
          hint="Run `make data-fetch` from the repo root to download the QUL data substrate (per ADR-0002)."
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

  if (response.verses.length === 0) {
    return (
      <EmptyState
        title="No verses returned"
        hint="The backend returned an empty list. Confirm /v1/chapters/:id/verses is wired."
      />
    );
  }

  return (
    <div className="reveal paper-card-raised px-6 py-12 md:px-16 md:py-16">
      {/* Bismillah header (skip surah 9) */}
      {surahNumber !== 9 ? (
        <div className="text-center pb-10">
          <div className="rule-hairline mx-auto max-w-xs" />
          <p
            dir="rtl"
            className="font-arabic mt-8 text-4xl md:text-5xl text-ink-strong leading-[1.8]"
            style={{ unicodeBidi: 'plaintext', fontWeight: 600 }}
            aria-label="Bismillah"
          >
            {BASMALA}
          </p>
          <div className="rule-hairline mx-auto max-w-xs mt-8" />
        </div>
      ) : null}

      {/* Verses */}
      <div className="mt-4">
        <article
          dir="rtl"
          className="font-arabic text-ink-strong"
          style={{
            fontSize: 'clamp(1.75rem, 1.5rem + 1.2vw, 2.5rem)',
            lineHeight: 2.1,
            textAlign: 'justify',
            textJustify: 'inter-word',
            unicodeBidi: 'plaintext',
            fontWeight: 600,
          }}
        >
          {response.verses.map((v) => (
            <span key={v.verseKey}>
              <span>{v.textUthmani.replace(/[٠-٩]+\s*$/u, '').trim()}</span>{' '}
              <span
                aria-label={`Ayah ${v.ayah.toString()}`}
                className="rosette inline-flex relative align-middle"
                style={{ width: '2em', height: '2em' }}
              >
                <RosetteGlyph size={36} />
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center font-arabic text-sm text-leaf"
                  style={{ fontSize: '0.62em', lineHeight: 1 }}
                >
                  {arabicNumeral(v.ayah)}
                </span>
              </span>
              {' '}
            </span>
          ))}
        </article>
      </div>
    </div>
  );
}

export default async function ReadSurahPage({
  params,
  searchParams,
}: PageProps): Promise<ReactNode> {
  const [{ surah }, { layout: layoutQuery }] = await Promise.all([params, searchParams]);
  const surahNumber = Number.parseInt(surah, 10);
  if (!Number.isFinite(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl p-6 py-20">
          <EmptyState
            title="Surah not found"
            hint={`Surah index must be between 1 and 114. Got "${surah}".`}
          />
        </div>
      </>
    );
  }
  const baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  const [availableLayouts, meta] = await Promise.all([
    fetchLayouts(baseUrl),
    fetchSurahMeta(baseUrl, surahNumber),
  ]);
  const currentLayout =
    layoutQuery && availableLayouts.includes(layoutQuery) ? layoutQuery : 'madani_15';

  return (
    <>
      <SiteNav />

      {/* Editorial running header — mushaf-style with surah Arabic on right, page number on left */}
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-5xl items-end justify-between gap-6 px-6 py-10">
          <div>
            <p className="smallcaps text-leaf text-xs">Sūrat</p>
            <h1 className="font-display mt-2 text-4xl font-light tracking-tight">
              {meta?.nameEnglish ?? `Surah ${surahNumber.toString()}`}
            </h1>
            {meta ? (
              <p className="mt-2 text-sm text-ink-muted">
                <span className="font-mono tabular-nums">{surahNumber.toString().padStart(3, '0')}</span>{' · '}
                {meta.verseCount.toString()} verses · revealed in {meta.revelationPlace}
              </p>
            ) : null}
          </div>
          <p
            dir="rtl"
            className="font-arabic text-5xl md:text-6xl text-ink-strong"
            style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
          >
            {meta?.nameArabic ?? ''}
          </p>
        </div>

        {availableLayouts.length > 0 ? (
          <div className="mx-auto max-w-5xl px-6 pb-6">
            <LayoutSwitcher availableLayouts={availableLayouts} currentLayout={currentLayout} />
          </div>
        ) : null}
      </header>

      <article className="mx-auto max-w-3xl px-2 py-12 md:px-6">
        <Suspense fallback={<LoadingState label="Loading surah…" lines={8} />}>
          <SurahBody surahNumber={surahNumber} />
        </Suspense>
      </article>

      <nav aria-label="Surah navigation" className="mx-auto max-w-3xl px-6 py-12 border-t border-hairline">
        <div className="flex items-baseline justify-between text-sm">
          {surahNumber > 1 ? (
            <a href={`/read/${(surahNumber - 1).toString()}`} className="smallcaps text-ink-muted hover:text-leaf">
              ← Previous · {arabicNumeral(surahNumber - 1)}
            </a>
          ) : <span />}
          {surahNumber < 114 ? (
            <a href={`/read/${(surahNumber + 1).toString()}`} className="smallcaps text-ink-muted hover:text-leaf">
              Next · {arabicNumeral(surahNumber + 1)} →
            </a>
          ) : <span />}
        </div>
      </nav>
    </>
  );
}
