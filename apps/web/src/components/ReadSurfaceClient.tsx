'use client';

/**
 * ReadSurfaceClient — single client island that owns the state of /read/[surah].
 *
 * Owns:
 *  - translation slug (or 'none' for Arabic-only)
 *  - reciter slug
 *  - layout slug (page-faithful mushaf — links out to /mushaf/:layout/:page)
 *  - view mode: 'continuous' (Quranly-style stacked cards) or 'single' (one
 *    ayah at a time with prev/next pagination)
 *
 * Hydration-safe: initial state is computed deterministically from the server-
 * provided defaults. URL params + localStorage are read in a useEffect only,
 * so the first client render matches the SSR HTML exactly. The hydration
 * mismatch warning the user reported is fixed here.
 *
 * Mobile-first: chip rows scroll horizontally inside their own overflow-x-auto
 * container; never push the page width past the viewport (globals.css also
 * pins overflow-x on html/body as defense-in-depth).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { AyahCard } from './AyahCard.js';
import { HairlineDivider } from './Glyph.js';

export interface VerseLite {
  readonly verseKey: string;
  readonly textUthmani: string;
}

interface TranslationItem {
  readonly slug: string;
  readonly name: string;
  readonly translator: string;
  readonly language: string;
}

interface ReciterItem {
  readonly slug: string;
  readonly name: { en: string; ar: string };
  readonly style?: string;
}

interface LayoutItem {
  readonly slug: string;
  readonly name: string;
  readonly subtitle?: string;
}

interface Props {
  readonly apiBase: string;
  readonly verses: readonly VerseLite[];
  readonly translations: readonly TranslationItem[];
  readonly reciters: readonly ReciterItem[];
  readonly layouts: readonly LayoutItem[];
  readonly tafsirSlug: string;
  readonly defaultTranslation: string;
  readonly defaultReciter: string;
  readonly defaultLayout: string;
  readonly prefetchedTranslation?: Record<string, string>;
}

const STORE_T = 'qalaam-translation';
const STORE_R = 'qalaam-reciter';
const STORE_VIEW = 'qalaam-read-view';

type ViewMode = 'continuous' | 'single';

function arabicNumeral(n: number): string {
  return n.toString().split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d).join('');
}

export function ReadSurfaceClient({
  apiBase,
  verses,
  translations,
  reciters,
  layouts,
  tafsirSlug,
  defaultTranslation,
  defaultReciter,
  defaultLayout,
  prefetchedTranslation,
}: Props): ReactNode {
  // Initialize with defaults — guaranteed to match SSR. Refined in useEffect.
  const [translation, setTranslation] = useState<string>(defaultTranslation);
  const [reciter, setReciter] = useState<string>(defaultReciter);
  const [layout, setLayout] = useState<string>(defaultLayout);
  const [viewMode, setViewMode] = useState<ViewMode>('continuous');
  const [singleIndex, setSingleIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  // Seed the translation map from the SSR prefetch so the first paint shows
  // translations under each verse.
  const [translationMap, setTranslationMap] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    if (prefetchedTranslation) {
      for (const [k, v] of Object.entries(prefetchedTranslation)) m.set(k, v);
    }
    return m;
  });
  const [translationLoading, setTranslationLoading] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  // Hydration-safe sync from URL + localStorage AFTER first render
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const t = url.searchParams.get('t') ?? window.localStorage.getItem(STORE_T) ?? defaultTranslation;
      const r = url.searchParams.get('r') ?? window.localStorage.getItem(STORE_R) ?? defaultReciter;
      const v = (window.localStorage.getItem(STORE_VIEW) as ViewMode | null) ?? 'continuous';
      const validT = t === 'none' || translations.some((x) => x.slug === t) ? t : defaultTranslation;
      const validR = reciters.some((x) => x.slug === r) ? r : defaultReciter;
      setTranslation(validT);
      setReciter(validR);
      setViewMode(v === 'single' ? 'single' : 'continuous');
    } catch {
      /* ignore */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist + URL-sync on user choice changes (only after hydration so we don't
  // double-write on first render)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const url = new URL(window.location.href);
      if (translation === defaultTranslation || translation === 'pickthall') url.searchParams.delete('t');
      else url.searchParams.set('t', translation);
      if (reciter === defaultReciter) url.searchParams.delete('r');
      else url.searchParams.set('r', reciter);
      window.history.replaceState(null, '', url.toString());
      window.localStorage.setItem(STORE_T, translation);
      window.localStorage.setItem(STORE_R, reciter);
      window.localStorage.setItem(STORE_VIEW, viewMode);
    } catch {
      /* ignore */
    }
  }, [translation, reciter, viewMode, hydrated, defaultTranslation, defaultReciter]);

  // Fetch translation pack whenever translation changes (skip if 'none').
  // For the SSR-prefetched default translation we already have all rows so
  // we skip the network round-trip on first mount.
  useEffect(() => {
    if (translation === 'none' || verses.length === 0) {
      setTranslationMap(new Map());
      return;
    }
    if (
      translation === defaultTranslation &&
      prefetchedTranslation &&
      Object.keys(prefetchedTranslation).length === verses.length
    ) {
      // Already seeded.
      return;
    }
    let cancelled = false;
    setTranslationLoading(true);
    void (async () => {
      const out = new Map<string, string>();
      const CHUNK = 24;
      for (let i = 0; i < verses.length; i += CHUNK) {
        if (cancelled) return;
        const slice = verses.slice(i, i + CHUNK);
        await Promise.all(
          slice.map(async (v) => {
            try {
              const res = await fetch(
                `${apiBase}/v1/translations/${translation}/by_verse/${encodeURIComponent(v.verseKey)}`,
              );
              if (!res.ok) return;
              const body = (await res.json()) as { text: string };
              if (body.text) out.set(v.verseKey, body.text);
            } catch {
              /* ignore */
            }
          }),
        );
      }
      if (!cancelled) {
        setTranslationMap(out);
        setTranslationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [translation, verses, apiBase]);

  const activeTranslation = useMemo(
    () => (translation !== 'none' ? translations.find((t) => t.slug === translation) ?? null : null),
    [translation, translations],
  );

  const activeLayout = useMemo(
    () => layouts.find((l) => l.slug === layout) ?? null,
    [layout, layouts],
  );

  function pickTranslation(next: string): void {
    setTranslation(next);
    setSingleIndex(0);
  }

  function pickReciter(next: string): void {
    setReciter(next);
  }

  function pickLayout(next: string): void {
    setLayout(next);
  }

  function pickView(next: ViewMode): void {
    setViewMode(next);
    setSingleIndex(0);
  }

  function goPrev(): void {
    setSingleIndex((i) => Math.max(0, i - 1));
    requestAnimationFrame(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function goNext(): void {
    setSingleIndex((i) => Math.min(verses.length - 1, i + 1));
    requestAnimationFrame(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // Surah number for the mushaf-link
  const firstVk = verses[0]?.verseKey ?? '1:1';
  const surahN = Number.parseInt(firstVk.split(':')[0] ?? '1', 10);

  return (
    <>
      {/* Sticky chip-bar — three rows: translation, reciter, layout/view */}
      <div className="border-b border-hairline bg-paper-100/95 backdrop-blur-md sticky top-[60px] sm:top-[68px] z-20">
        <div className="mx-auto max-w-5xl px-3 sm:px-6 py-2.5 space-y-2">
          <ChipRow label="Translation">
            <Chip active={translation === 'none'} onClick={() => pickTranslation('none')}>
              Arabic only
            </Chip>
            {translations.map((t) => (
              <Chip
                key={t.slug}
                active={translation === t.slug}
                onClick={() => pickTranslation(t.slug)}
                title={t.translator}
              >
                {t.name.replace(/^The /, '')}
              </Chip>
            ))}
          </ChipRow>

          <ChipRow label="Reciter">
            {reciters.map((r) => (
              <Chip
                key={r.slug}
                active={reciter === r.slug}
                onClick={() => pickReciter(r.slug)}
                title={`${r.name.en}${r.style ? ` · ${r.style}` : ''}`}
              >
                {r.name.en.replace(/^.* /, '').replace(/^al-/, '')}
              </Chip>
            ))}
          </ChipRow>

          <ChipRow label="Layout">
            <Chip active={viewMode === 'continuous'} onClick={() => pickView('continuous')}>
              Continuous
            </Chip>
            <Chip active={viewMode === 'single'} onClick={() => pickView('single')}>
              One ayah
            </Chip>
            {layouts.length > 0 ? <span className="mx-1 text-ink-muted/40">|</span> : null}
            {layouts.map((l) => (
              <Chip
                key={l.slug}
                active={layout === l.slug}
                onClick={() => pickLayout(l.slug)}
                title={l.subtitle ?? ''}
              >
                {l.name.replace(/^Madinah Mushaf/, 'Madinah').replace(/^Madinah · /, '')}
              </Chip>
            ))}
            {activeLayout ? (
              <a
                href={`/mushaf/${activeLayout.slug}/page-for/${encodeURIComponent(firstVk)}`}
                className="ml-1 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] sm:text-xs smallcaps tracking-wider text-leaf hover:bg-paper-200/60 border border-leaf/40"
              >
                Open mushaf →
              </a>
            ) : null}
          </ChipRow>
        </div>
      </div>

      {/* Translator attribution — once per surah, only when translation chosen */}
      {activeTranslation ? (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-4 sm:pt-6">
          <p className="text-[11px] sm:text-xs text-ink-muted text-center leading-relaxed">
            <span className="smallcaps tracking-widest">Translation</span>
            <span className="block sm:inline sm:mx-2 mt-1 sm:mt-0">
              <span>{activeTranslation.name}</span>
              <span className="mx-2 opacity-50">·</span>
              <span className="italic">{activeTranslation.translator}</span>
              {translationLoading ? (
                <span className="mx-2 opacity-60 italic">loading…</span>
              ) : null}
            </span>
          </p>
        </div>
      ) : null}

      <main
        ref={containerRef as React.RefObject<HTMLElement>}
        className="mx-auto max-w-3xl px-3 sm:px-6 py-5 sm:py-10 space-y-4 sm:space-y-6"
      >
        {viewMode === 'continuous' ? (
          verses.map((v) => (
            <AyahCard
              key={v.verseKey}
              verseKey={v.verseKey}
              arabic={v.textUthmani}
              translation={translation === 'none' ? null : translationMap.get(v.verseKey) ?? null}
              tafsirSlug={tafsirSlug}
              reciterSlug={reciter}
              apiBase={apiBase}
            />
          ))
        ) : (
          <SingleAyahView
            verses={verses}
            index={singleIndex}
            translation={translation}
            translationMap={translationMap}
            tafsirSlug={tafsirSlug}
            reciterSlug={reciter}
            apiBase={apiBase}
            onPrev={goPrev}
            onNext={goNext}
            surahN={surahN}
          />
        )}

        <nav
          aria-label="Surah navigation"
          className="flex items-baseline justify-between text-sm pt-10 mt-6 border-t border-hairline"
        >
          {surahN > 1 ? (
            <a
              href={`/read/${(surahN - 1).toString()}`}
              className="smallcaps text-ink-muted hover:text-leaf"
            >
              ← Sūrah {arabicNumeral(surahN - 1)}
            </a>
          ) : (
            <span />
          )}
          {surahN < 114 ? (
            <a
              href={`/read/${(surahN + 1).toString()}`}
              className="smallcaps text-ink-muted hover:text-leaf"
            >
              Sūrah {arabicNumeral(surahN + 1)} →
            </a>
          ) : (
            <span />
          )}
        </nav>
      </main>
    </>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto -mx-1 px-1 scrollbar-thin">
      <span className="smallcaps text-leaf text-[10px] sm:text-[11px] tracking-widest shrink-0 w-[64px] sm:w-[78px]">
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-max">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3 py-1 text-[11px] sm:text-xs smallcaps tracking-wider transition-colors border ${
        active
          ? 'bg-leaf text-paper border-leaf'
          : 'border-hairline text-ink hover:bg-paper-200/60'
      }`}
    >
      {children}
    </button>
  );
}

function SingleAyahView({
  verses,
  index,
  translation,
  translationMap,
  tafsirSlug,
  reciterSlug,
  apiBase,
  onPrev,
  onNext,
  surahN,
}: {
  verses: readonly VerseLite[];
  index: number;
  translation: string;
  translationMap: Map<string, string>;
  tafsirSlug: string;
  reciterSlug: string;
  apiBase: string;
  onPrev: () => void;
  onNext: () => void;
  surahN: number;
}): ReactNode {
  const v = verses[index];
  if (!v) return null;
  const total = verses.length;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          aria-label="Previous ayah"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full text-ink hover:bg-paper-200/60 disabled:opacity-30"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M15 18l-6-6 6-6v12z" />
          </svg>
        </button>
        <p className="text-xs smallcaps tracking-widest text-ink-muted tabular-nums">
          Ayah {(index + 1).toString()} <span className="opacity-50">/ {total.toString()}</span>
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={index === total - 1}
          aria-label="Next ayah"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full text-ink hover:bg-paper-200/60 disabled:opacity-30"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M9 6l6 6-6 6V6z" />
          </svg>
        </button>
      </div>

      <AyahCard
        key={v.verseKey}
        verseKey={v.verseKey}
        arabic={v.textUthmani}
        translation={translation === 'none' ? null : translationMap.get(v.verseKey) ?? null}
        tafsirSlug={tafsirSlug}
        reciterSlug={reciterSlug}
        apiBase={apiBase}
      />

      <HairlineDivider />

      <div className="flex justify-between text-xs smallcaps">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          className="text-ink-muted hover:text-leaf disabled:opacity-30"
        >
          ← {verses[Math.max(0, index - 1)]?.verseKey ?? ''}
        </button>
        <span className="text-ink-muted tabular-nums">{surahN.toString()}:{(index + 1).toString()}</span>
        <button
          type="button"
          onClick={onNext}
          disabled={index === total - 1}
          className="text-ink-muted hover:text-leaf disabled:opacity-30"
        >
          {verses[Math.min(total - 1, index + 1)]?.verseKey ?? ''} →
        </button>
      </div>
    </div>
  );
}
