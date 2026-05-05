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

import { resolveApiBase } from '../lib/api-base.js';

import { AyahCard } from './AyahCard.js';
import { AyahMushafLines } from './AyahMushafLines.js';
import { ContinuousReaderPlayer } from './ContinuousReaderPlayer.js';
import { HairlineDivider } from './Glyph.js';
import { TajweedLegend } from './TajweedLegend.js';
import { TranslationPicker } from './TranslationPicker.js';

import type { ReactNode } from 'react';

export interface VerseLite {
  readonly verseKey: string;
  readonly textUthmani: string;
  readonly textIndopak?: string | null;
  readonly textImlaei?: string | null;
}

/**
 * Pick the best Arabic text for the active layout. Falls back to
 * Uthmani when the script-specific field isn't present.
 */
function textForLayout(v: VerseLite, layoutSlug: string): string {
  if (layoutSlug === 'kfgqpc_v1' || layoutSlug === 'indopak') {
    return v.textIndopak ?? v.textUthmani;
  }
  return v.textUthmani;
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
  /** Word-level segment coverage. 0 = audio only (no live highlight);
   *  >0 = the number of verses with timing data. */
  readonly segmentCoverage?: number;
}

interface LayoutItem {
  readonly slug: string;
  readonly urlSlug?: string;
  readonly name: string;
  readonly subtitle?: string;
}

interface TransliterationItem {
  readonly slug: string;
  readonly name: string;
  readonly language: string;
}

// 'off' = no transliteration; otherwise the slug of the active edition.
// Treated as a plain string since the slug comes from the backend catalog,
// but kept as a named alias for readability at call sites.
type TransliterationChoice = string;

interface Props {
  /** Optional, ignored — always resolves to same-origin /api on client. */
  readonly apiBase?: string;
  readonly verses: readonly VerseLite[];
  readonly translations: readonly TranslationItem[];
  readonly reciters: readonly ReciterItem[];
  readonly layouts: readonly LayoutItem[];
  readonly transliterations?: readonly TransliterationItem[];
  readonly tafsirSlug: string;
  readonly defaultTranslation: string;
  readonly defaultReciter: string;
  readonly prefetchedTranslation?: Record<string, string>;
}

const STORE_T = 'qalaam-translation';
const STORE_R = 'qalaam-reciter';
const STORE_VIEW = 'qalaam-read-view';
const STORE_LAYOUT = 'qalaam-read-layout';
const STORE_SINGLE_STYLE = 'qalaam-single-style';
const STORE_TLIT = 'qalaam-transliteration';

// Three top-level reading modes:
//   continuous - vertical scroll of ayah cards
//   single     - one ayah at a time with prev/next pagination
//   mushaf     - page-faithful mushaf rendering (one mushaf page on screen)
// 'mushaf' replaces the older single-ayah Mushaf style toggle so the
// rendering is its own first-class mode.
type ViewMode = 'continuous' | 'single' | 'mushaf';
type SingleStyle = 'card' | 'mushaf';

function arabicNumeral(n: number): string {
  return n
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
    .join('');
}

export function ReadSurfaceClient({
  verses,
  translations,
  reciters,
  layouts,
  transliterations = [],
  tafsirSlug,
  defaultTranslation,
  defaultReciter,
  prefetchedTranslation,
}: Props): ReactNode {
  const apiBase = resolveApiBase();
  // Initialize with defaults — guaranteed to match SSR. Refined in useEffect.
  const [translation, setTranslation] = useState<string>(defaultTranslation);
  const [reciter, setReciter] = useState<string>(defaultReciter);
  const [activeLayoutSlug, setActiveLayoutSlug] = useState<string>(layouts[0]?.slug ?? 'madani_15');
  const [viewMode, setViewMode] = useState<ViewMode>('continuous');
  const [singleStyle, setSingleStyle] = useState<SingleStyle>('card');
  const [singleIndex, setSingleIndex] = useState(0);
  const [singleDirection, setSingleDirection] = useState<'next' | 'prev' | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [highlight, setHighlight] = useState<{ verseKey: string; wordIndex: number } | null>(null);

  // When the continuous player advances verse, also advance the
  // single-ayah view's index so the highlight is visible in that
  // mode too — otherwise the user is staring at a static ayah while
  // the audio is on a different one.
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

  // Transliteration is opt-in (default 'off') — adds cognitive load when on,
  // accessibility when needed. State lives next to translation since the
  // fetch shape is identical: slug + verse-key → text.
  const [transliteration, setTransliteration] = useState<TransliterationChoice>('off');
  const [transliterationMap, setTransliterationMap] = useState<Map<string, string>>(
    () => new Map(),
  );

  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!highlight) return;
    if (viewMode !== 'single') return;
    const idx = verses.findIndex((v) => v.verseKey === highlight.verseKey);
    if (idx >= 0 && idx !== singleIndex) {
      setSingleDirection(idx > singleIndex ? 'next' : 'prev');
      setSingleIndex(idx);
    }
  }, [highlight, viewMode, verses, singleIndex]);

  // Auto-scroll the active verse into view in continuous mode. The
  // ayah card uses `id={verseKey}` so we can locate it by selector
  // and smoothly scroll it to ~30% from the top of the viewport.
  // Skip during user interaction (we'll re-enable on idle).
  const lastScrolledVkRef = useRef<string>('');
  useEffect(() => {
    if (viewMode !== 'continuous') return;
    if (!highlight) return;
    if (highlight.verseKey === lastScrolledVkRef.current) return;
    lastScrolledVkRef.current = highlight.verseKey;
    if (typeof window === 'undefined') return;
    const el = document.getElementById(highlight.verseKey);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }, [highlight, viewMode]);

  // Hydration-safe sync from URL + localStorage AFTER first render
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const t =
        url.searchParams.get('t') ?? window.localStorage.getItem(STORE_T) ?? defaultTranslation;
      const r = url.searchParams.get('r') ?? window.localStorage.getItem(STORE_R) ?? defaultReciter;
      const v = (window.localStorage.getItem(STORE_VIEW) as ViewMode | null) ?? 'continuous';
      const lt = window.localStorage.getItem(STORE_LAYOUT);
      const ss = (window.localStorage.getItem(STORE_SINGLE_STYLE) as SingleStyle | null) ?? 'card';
      const validT =
        t === 'none' || translations.some((x) => x.slug === t) ? t : defaultTranslation;
      const validR = reciters.some((x) => x.slug === r) ? r : defaultReciter;
      const validL =
        lt && layouts.some((x) => x.slug === lt) ? lt : (layouts[0]?.slug ?? 'madani_15');
      const tlit = window.localStorage.getItem(STORE_TLIT) ?? 'off';
      const validTlit: TransliterationChoice =
        tlit === 'off' || transliterations.some((x) => x.slug === tlit) ? tlit : 'off';
      setTranslation(validT);
      setReciter(validR);
      setActiveLayoutSlug(validL);
      setViewMode(v === 'single' ? 'single' : 'continuous');
      setSingleStyle(ss === 'mushaf' ? 'mushaf' : 'card');
      setTransliteration(validTlit);
    } catch {
      /* ignore */
    }
    setHydrated(true);
    // Run only on mount — we read URL + localStorage once. The deps array
    // would otherwise pull in every default* value, defeating the purpose.
  }, [defaultReciter, defaultTranslation, layouts, reciters, translations, transliterations]);

  // Persist + URL-sync on user choice changes (only after hydration so we don't
  // double-write on first render)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const url = new URL(window.location.href);
      if (translation === defaultTranslation || translation === 'pickthall')
        url.searchParams.delete('t');
      else url.searchParams.set('t', translation);
      if (reciter === defaultReciter) url.searchParams.delete('r');
      else url.searchParams.set('r', reciter);
      window.history.replaceState(null, '', url.toString());
      window.localStorage.setItem(STORE_T, translation);
      window.localStorage.setItem(STORE_R, reciter);
      window.localStorage.setItem(STORE_VIEW, viewMode);
      window.localStorage.setItem(STORE_LAYOUT, activeLayoutSlug);
      window.localStorage.setItem(STORE_SINGLE_STYLE, singleStyle);
    } catch {
      /* ignore */
    }
  }, [
    translation,
    reciter,
    viewMode,
    activeLayoutSlug,
    singleStyle,
    hydrated,
    defaultTranslation,
    defaultReciter,
  ]);

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
    // Boxed flag so TS doesn't narrow `cancelled` to always-false inside
    // the IIFE — the cleanup callback mutates it after the closure starts.
    const cancelled = { v: false };
    setTranslationLoading(true);
    void (async () => {
      const out = new Map<string, string>();
      const CHUNK = 24;
      for (let i = 0; i < verses.length; i += CHUNK) {
        if (cancelled.v) return;
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
      if (!cancelled.v) {
        setTranslationMap(out);
        setTranslationLoading(false);
      }
    })();
    return () => {
      cancelled.v = true;
    };
  }, [translation, verses, apiBase]);

  const activeTranslation = useMemo(
    () =>
      translation !== 'none' ? (translations.find((t) => t.slug === translation) ?? null) : null,
    [translation, translations],
  );

  // Fetch transliteration pack whenever the active edition changes.
  useEffect(() => {
    if (transliteration === 'off' || verses.length === 0) {
      setTransliterationMap(new Map());
      return;
    }
    const cancelled = { v: false };
    void (async () => {
      const out = new Map<string, string>();
      const CHUNK = 24;
      for (let i = 0; i < verses.length; i += CHUNK) {
        if (cancelled.v) return;
        const slice = verses.slice(i, i + CHUNK);
        await Promise.all(
          slice.map(async (v) => {
            try {
              const res = await fetch(
                `${apiBase}/v1/transliterations/${transliteration}/by_verse/${encodeURIComponent(v.verseKey)}`,
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
      if (!cancelled.v) setTransliterationMap(out);
    })();
    return () => {
      cancelled.v = true;
    };
  }, [transliteration, verses, apiBase]);

  function pickTransliteration(next: TransliterationChoice): void {
    setTransliteration(next);
    try {
      window.localStorage.setItem(STORE_TLIT, next);
    } catch {
      /* ignore */
    }
  }

  function pickTranslation(next: string): void {
    setTranslation(next);
    setSingleIndex(0);
  }

  function pickReciter(next: string): void {
    setReciter(next);
  }

  function pickView(next: ViewMode): void {
    setViewMode(next);
    setSingleIndex(0);
  }

  function goPrev(): void {
    setSingleIndex((i) => {
      if (i <= 0) return i;
      setSingleDirection('prev');
      return i - 1;
    });
    requestAnimationFrame(() =>
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
  function goNext(): void {
    setSingleIndex((i) => {
      if (i >= verses.length - 1) return i;
      setSingleDirection('next');
      return i + 1;
    });
    requestAnimationFrame(() =>
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  // Surah number for the mushaf-link
  const firstVk = verses[0]?.verseKey ?? '1:1';
  const surahN = Number.parseInt(firstVk.split(':')[0] ?? '1', 10);

  return (
    <>
      {/* Sticky chip-bar — three rows: translation, reciter, layout/view */}
      <div className="border-hairline bg-paper-100/95 sticky top-[60px] z-20 border-b backdrop-blur-md sm:top-[68px]">
        <div className="mx-auto max-w-5xl space-y-2 px-3 py-2.5 sm:px-6">
          <ChipRow label="Translation">
            {/* 59 translations across 28 languages — replace inline
                chip-row with a language-grouped bottom-sheet picker. */}
            <TranslationPicker
              translations={translations}
              value={translation}
              onChange={(next) => {
                pickTranslation(next);
              }}
            />
            {/* Pinned shortcuts: Arabic only + the user's last 2-3
                preferred translations could live here. For now we
                keep the picker as the single entry point. */}
          </ChipRow>

          <ChipRow label="Reciter">
            {reciters.map((r) => {
              const segmented = (r.segmentCoverage ?? 0) > 0;
              const titleSuffix = segmented
                ? ' · word-level highlight'
                : ' · audio only (no per-word highlight)';
              return (
                <Chip
                  key={r.slug}
                  active={reciter === r.slug}
                  onClick={() => {
                    pickReciter(r.slug);
                  }}
                  title={`${r.name.en}${r.style ? ` · ${r.style}` : ''}${titleSuffix}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {r.name.en.replace(/^.* /, '').replace(/^al-/, '')}
                    {segmented ? (
                      <span
                        aria-hidden
                        title="Word-level highlight available"
                        className="bg-leaf inline-block h-1.5 w-1.5 rounded-full"
                      />
                    ) : null}
                  </span>
                </Chip>
              );
            })}
          </ChipRow>
          {(() => {
            const active = reciters.find((r) => r.slug === reciter);
            if (!active) return null;
            const segmented = (active.segmentCoverage ?? 0) > 0;
            if (segmented) return null;
            return (
              <p className="text-ink-muted px-1 text-[11px] italic">
                <span className="text-leaf">Note:</span> {active.name.en} streams audio only —
                word-level highlight needs a reciter with timing data (look for the leaf-gold dot in
                the chip-row).
              </p>
            );
          })()}

          <ChipRow label="View">
            <Chip
              active={viewMode === 'continuous'}
              onClick={() => {
                pickView('continuous');
              }}
            >
              Continuous
            </Chip>
            <Chip
              active={viewMode === 'single'}
              onClick={() => {
                pickView('single');
              }}
            >
              One ayah
            </Chip>
            <Chip
              active={viewMode === 'mushaf'}
              onClick={() => {
                pickView('mushaf');
              }}
              title="Mushaf — page-faithful line breaks"
            >
              Mushaf
            </Chip>
          </ChipRow>

          {transliterations.length > 0 ? (
            <ChipRow label="Transliteration">
              <Chip
                active={transliteration === 'off'}
                onClick={() => {
                  pickTransliteration('off');
                }}
                title="Hide phonetic transliteration"
              >
                Off
              </Chip>
              {transliterations.map((t) => {
                // Short label per language: "Latin" / "Türkçe" / "Русский".
                const label =
                  t.language === 'en'
                    ? 'Latin'
                    : t.language === 'tr'
                      ? 'Türkçe'
                      : t.language === 'ru'
                        ? 'Русский'
                        : t.language;
                return (
                  <Chip
                    key={t.slug}
                    active={transliteration === t.slug}
                    onClick={() => {
                      pickTransliteration(t.slug);
                    }}
                    title={t.name}
                  >
                    {label}
                  </Chip>
                );
              })}
            </ChipRow>
          ) : null}

          {layouts.length > 0 ? (
            <ChipRow label="Layout">
              {layouts.map((l) => {
                const labelRaw = l.name || l.slug;
                const label =
                  labelRaw === l.slug
                    ? labelRaw
                    : labelRaw
                        .replace(/^Madinah Mushaf · /, 'Madinah · ')
                        .replace(/^Madinah Mushaf$/, 'Madinah')
                        .replace(/^Madinah Mushaf /, 'Madinah ');
                const isActive = activeLayoutSlug === l.slug;
                // ANY mode (continuous, one-ayah Card, one-ayah Mushaf):
                // tapping a Mushaf chip BINDS the active layout for the
                // current page. The script + font flip in place — no
                // navigation. A separate "Open page →" link below
                // takes you to the page-faithful /mushaf surface.
                return (
                  <Chip
                    key={l.slug}
                    active={isActive}
                    onClick={() => {
                      setActiveLayoutSlug(l.slug);
                    }}
                    title={l.subtitle ?? ''}
                  >
                    {label}
                  </Chip>
                );
              })}
              {(() => {
                const active = layouts.find((l) => l.slug === activeLayoutSlug) ?? layouts[0];
                if (!active) return null;
                return (
                  <>
                    <a
                      href={`/mushaf/${active.urlSlug ?? active.slug}/page-for/${encodeURIComponent(firstVk)}`}
                      title="Open the page-faithful mushaf for this verse"
                      className="smallcaps border-leaf/40 text-leaf hover:bg-leaf/10 ml-1 shrink-0 rounded-full border px-3 py-1 text-[11px] tracking-wider sm:text-xs"
                    >
                      Open page →
                    </a>
                    <a
                      href={`/mushaf-image/page-for/${encodeURIComponent(firstVk)}`}
                      title="Open the image-faithful KFGQPC page for this verse — preserves the visual position of every word"
                      className="smallcaps border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 shrink-0 rounded-full border px-3 py-1 text-[11px] tracking-wider sm:text-xs"
                    >
                      Open image →
                    </a>
                  </>
                );
              })()}
            </ChipRow>
          ) : null}
        </div>
      </div>

      {/* Translator attribution — once per surah, only when translation chosen.
          Dedupe when name === translator (e.g. "Saheeh International"). */}
      {activeTranslation ? (
        <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6">
          <p className="text-ink-muted text-center text-[11px] leading-relaxed sm:text-xs">
            <span className="smallcaps tracking-widest">Translation</span>
            <span className="mt-1 block sm:mx-2 sm:mt-0 sm:inline">
              <span>{activeTranslation.name}</span>
              {activeTranslation.translator &&
              activeTranslation.translator !== activeTranslation.name ? (
                <>
                  <span className="mx-2 opacity-50">·</span>
                  <span className="italic">{activeTranslation.translator}</span>
                </>
              ) : null}
              {translationLoading ? <span className="mx-2 italic opacity-60">loading…</span> : null}
            </span>
          </p>
        </div>
      ) : null}

      <main
        ref={containerRef as React.RefObject<HTMLElement>}
        className="mx-auto max-w-3xl space-y-4 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-10"
      >
        {viewMode === 'continuous' ? (
          verses.map((v) => (
            <AyahCard
              key={`${v.verseKey}-${activeLayoutSlug}`}
              verseKey={v.verseKey}
              arabic={textForLayout(v, activeLayoutSlug)}
              translation={translation === 'none' ? null : (translationMap.get(v.verseKey) ?? null)}
              transliteration={
                transliteration === 'off' ? null : (transliterationMap.get(v.verseKey) ?? null)
              }
              tafsirSlug={tafsirSlug}
              reciterSlug={reciter}
              apiBase={apiBase}
              layoutSlug={activeLayoutSlug}
              highlightWordIndex={highlight?.verseKey === v.verseKey ? highlight.wordIndex : null}
            />
          ))
        ) : viewMode === 'mushaf' ? (
          // Page-faithful mushaf rendering for THIS surah's verses.
          // Renders the same MushafLines used on /mushaf, scoped to
          // the verses on the current page so the user can read the
          // surah in mushaf form without leaving /read.
          <article
            id={`mushaf-${activeLayoutSlug}`}
            className="paper-card-raised p-4 sm:p-8 md:p-10"
            aria-label="Mushaf rendering"
          >
            {verses.map((v) => (
              <AyahMushafLines
                key={`${v.verseKey}-${activeLayoutSlug}`}
                verseKey={v.verseKey}
                layoutSlug={activeLayoutSlug}
                highlight={highlight?.verseKey === v.verseKey ? highlight : null}
              />
            ))}
          </article>
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
            direction={singleDirection}
            style={singleStyle}
            layoutSlug={activeLayoutSlug}
            highlight={highlight}
          />
        )}

        <nav
          aria-label="Surah navigation"
          className="border-hairline mt-6 flex items-baseline justify-between border-t pt-10 text-sm"
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

      {/* Continuous recitation player — sticky at bottom. Plays
          through every verse of the surah and emits highlight events
          for the current word. Reading the highlight state above
          paints the active word in AyahCard / SingleAyahView. */}
      <ContinuousReaderPlayer
        verses={verses}
        reciterSlug={reciter}
        reciterName={reciters.find((r) => r.slug === reciter)?.name.en}
        onHighlight={setHighlight}
        currentSurah={surahN}
      />

      {/* Tajweed legend — only when the user has flipped the layout to
          tajweed (slug 'kfgqpc_v4' or 'tajweed'). FAB pinned bottom-left,
          opens an editorial bottom-sheet. */}
      {activeLayoutSlug === 'kfgqpc_v4' || activeLayoutSlug === 'tajweed' ? (
        <TajweedLegend />
      ) : null}
    </>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="scrollbar-thin -mx-1 flex items-center gap-2 overflow-x-auto px-1 sm:gap-3">
      <span className="smallcaps text-leaf w-[64px] shrink-0 text-[10px] tracking-widest sm:w-[78px] sm:text-[11px]">
        {label}
      </span>
      <div className="flex min-w-max items-center gap-1.5">{children}</div>
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
      className={`smallcaps shrink-0 rounded-full border px-3 py-1 text-[11px] tracking-wider transition-colors sm:text-xs ${
        active ? 'bg-leaf text-paper border-leaf' : 'border-hairline text-ink hover:bg-paper-200/60'
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
  direction,
  style,
  layoutSlug,
  highlight,
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
  direction: 'next' | 'prev' | null;
  style: SingleStyle;
  layoutSlug: string;
  highlight: { verseKey: string; wordIndex: number } | null;
}): ReactNode {
  const v = verses[index];
  const swipe = useSwipePager({
    onSwipeNext: onNext,
    onSwipePrev: onPrev,
    canNext: index < verses.length - 1,
    canPrev: index > 0,
  });
  if (!v) return null;
  const total = verses.length;
  const slideClass =
    direction === 'next' ? 'slide-in-next' : direction === 'prev' ? 'slide-in-prev' : '';
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          aria-label="Previous ayah"
          className="text-ink hover:bg-paper-200/60 inline-flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M15 18l-6-6 6-6v12z" />
          </svg>
        </button>
        <p className="smallcaps text-ink-muted text-xs tabular-nums tracking-widest">
          Ayah {(index + 1).toString()} <span className="opacity-50">/ {total.toString()}</span>
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={index === total - 1}
          aria-label="Next ayah"
          className="text-ink hover:bg-paper-200/60 inline-flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M9 6l6 6-6 6V6z" />
          </svg>
        </button>
      </div>

      {/* Touch / pointer swipe surface. Use `key` to force the slide
          animation to replay on each ayah change. */}
      <div
        key={`${v.verseKey}-${style}-${layoutSlug}`}
        className={`${slideClass} ${swipe.dragging ? 'swipe-drag' : 'swipe-spring-back'} touch-pan-y select-none`}
        style={{ ['--swipe-x' as string]: swipe.dragging ? `${String(swipe.dx)}px` : '0px' }}
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
        onTouchCancel={swipe.onTouchCancel}
        onPointerDown={swipe.onPointerDown}
        onPointerMove={swipe.onPointerMove}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
        aria-roledescription="Swipeable ayah pager"
      >
        {style === 'mushaf' ? (
          <div className="space-y-4">
            <AyahMushafLines
              apiBase={apiBase}
              verseKey={v.verseKey}
              layoutSlug={layoutSlug}
              highlight={highlight?.verseKey === v.verseKey ? highlight : null}
            />
            {translation !== 'none' && translationMap.get(v.verseKey) ? (
              <div className="paper-card p-5 sm:p-7">
                <p className="smallcaps text-leaf mb-2 text-[10px] tracking-widest">Translation</p>
                <p
                  dir="ltr"
                  lang="en"
                  className="text-ink/90 mx-auto max-w-prose text-[15px] leading-relaxed sm:text-base"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {translationMap.get(v.verseKey)}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <AyahCard
            verseKey={v.verseKey}
            arabic={textForLayout(v, layoutSlug)}
            translation={translation === 'none' ? null : (translationMap.get(v.verseKey) ?? null)}
            tafsirSlug={tafsirSlug}
            reciterSlug={reciterSlug}
            apiBase={apiBase}
            layoutSlug={layoutSlug}
            highlightWordIndex={highlight?.verseKey === v.verseKey ? highlight.wordIndex : null}
          />
        )}
      </div>

      <HairlineDivider />

      <div className="smallcaps flex justify-between text-xs">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          className="text-ink-muted hover:text-leaf disabled:opacity-30"
        >
          ← {verses[Math.max(0, index - 1)]?.verseKey ?? ''}
        </button>
        <span className="text-ink-muted tabular-nums">
          {surahN.toString()}:{(index + 1).toString()}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={index === total - 1}
          className="text-ink-muted hover:text-leaf disabled:opacity-30"
        >
          {verses[Math.min(total - 1, index + 1)]?.verseKey ?? ''} →
        </button>
      </div>

      <p className="smallcaps text-ink-muted/70 pt-2 text-center text-[10px] tracking-widest">
        Swipe ← for next · Swipe → for previous
      </p>
    </div>
  );
}

/**
 * useSwipePager — minimal touch + pointer swipe handler for horizontal
 * pagination. Triggers onSwipeNext when the gesture moves left past
 * threshold, onSwipePrev when it moves right past threshold. Vertical
 * scrolling is preserved via `touch-action: pan-y` on the consuming
 * element.
 */
function useSwipePager({
  onSwipeNext,
  onSwipePrev,
  canNext,
  canPrev,
  threshold = 60,
}: {
  onSwipeNext: () => void;
  onSwipePrev: () => void;
  canNext: boolean;
  canPrev: boolean;
  threshold?: number;
}): {
  dragging: boolean;
  dx: number;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
} {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lockedAxisRef = useRef<'x' | 'y' | null>(null);
  const pointerActiveRef = useRef(false);

  function begin(x: number, y: number): void {
    startXRef.current = x;
    startYRef.current = y;
    lockedAxisRef.current = null;
    setDragging(false);
    setDx(0);
  }
  function move(x: number, y: number): boolean {
    if (startXRef.current === null || startYRef.current === null) return false;
    const ddx = x - startXRef.current;
    const ddy = y - startYRef.current;
    if (lockedAxisRef.current === null) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return false;
      lockedAxisRef.current = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
    }
    if (lockedAxisRef.current === 'y') return false;
    setDragging(true);
    setDx(ddx);
    return true;
  }
  function end(): void {
    const finalDx = dx;
    setDragging(false);
    setDx(0);
    startXRef.current = null;
    startYRef.current = null;
    lockedAxisRef.current = null;
    if (Math.abs(finalDx) < threshold) return;
    if (finalDx < 0 && canNext) onSwipeNext();
    else if (finalDx > 0 && canPrev) onSwipePrev();
  }
  return {
    dragging,
    dx,
    onTouchStart: (e) => {
      begin(e.touches[0]?.clientX ?? 0, e.touches[0]?.clientY ?? 0);
    },
    onTouchMove: (e) => {
      const consumed = move(e.touches[0]?.clientX ?? 0, e.touches[0]?.clientY ?? 0);
      if (consumed && e.cancelable) e.preventDefault();
    },
    onTouchEnd: end,
    onTouchCancel: end,
    onPointerDown: (e) => {
      if (e.pointerType === 'touch') return; // touch handled above
      pointerActiveRef.current = true;
      begin(e.clientX, e.clientY);
    },
    onPointerMove: (e) => {
      if (!pointerActiveRef.current) return;
      move(e.clientX, e.clientY);
    },
    onPointerUp: () => {
      if (!pointerActiveRef.current) return;
      pointerActiveRef.current = false;
      end();
    },
    onPointerCancel: () => {
      if (!pointerActiveRef.current) return;
      pointerActiveRef.current = false;
      end();
    },
  };
}

export { useSwipePager };
