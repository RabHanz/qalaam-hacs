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

import { resolveApiBase } from '../lib/api-base.js';
import { AyahCard } from './AyahCard.js';
import { AyahMushafLines } from './AyahMushafLines.js';
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
  readonly urlSlug?: string;
  readonly name: string;
  readonly subtitle?: string;
}

interface Props {
  /** Optional, ignored — always resolves to same-origin /api on client. */
  readonly apiBase?: string;
  readonly verses: readonly VerseLite[];
  readonly translations: readonly TranslationItem[];
  readonly reciters: readonly ReciterItem[];
  readonly layouts: readonly LayoutItem[];
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

type ViewMode = 'continuous' | 'single';
type SingleStyle = 'card' | 'mushaf';

function arabicNumeral(n: number): string {
  return n.toString().split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d).join('');
}

export function ReadSurfaceClient({
  verses,
  translations,
  reciters,
  layouts,
  tafsirSlug,
  defaultTranslation,
  defaultReciter,
  prefetchedTranslation,
}: Props): ReactNode {
  const apiBase = resolveApiBase();
  // Initialize with defaults — guaranteed to match SSR. Refined in useEffect.
  const [translation, setTranslation] = useState<string>(defaultTranslation);
  const [reciter, setReciter] = useState<string>(defaultReciter);
  const [activeLayoutSlug, setActiveLayoutSlug] = useState<string>(
    layouts[0]?.slug ?? 'madani_15',
  );
  const [viewMode, setViewMode] = useState<ViewMode>('continuous');
  const [singleStyle, setSingleStyle] = useState<SingleStyle>('card');
  const [singleIndex, setSingleIndex] = useState(0);
  const [singleDirection, setSingleDirection] = useState<'next' | 'prev' | null>(null);
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
      const lt = window.localStorage.getItem(STORE_LAYOUT);
      const ss = (window.localStorage.getItem(STORE_SINGLE_STYLE) as SingleStyle | null) ?? 'card';
      const validT = t === 'none' || translations.some((x) => x.slug === t) ? t : defaultTranslation;
      const validR = reciters.some((x) => x.slug === r) ? r : defaultReciter;
      const validL = lt && layouts.some((x) => x.slug === lt) ? lt : layouts[0]?.slug ?? 'madani_15';
      setTranslation(validT);
      setReciter(validR);
      setActiveLayoutSlug(validL);
      setViewMode(v === 'single' ? 'single' : 'continuous');
      setSingleStyle(ss === 'mushaf' ? 'mushaf' : 'card');
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
    requestAnimationFrame(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function goNext(): void {
    setSingleIndex((i) => {
      if (i >= verses.length - 1) return i;
      setSingleDirection('next');
      return i + 1;
    });
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

          <ChipRow label="View">
            <Chip active={viewMode === 'continuous'} onClick={() => pickView('continuous')}>
              Continuous
            </Chip>
            <Chip active={viewMode === 'single'} onClick={() => pickView('single')}>
              One ayah
            </Chip>
            {viewMode === 'single' ? (
              <>
                <span className="mx-1 text-ink-muted/40 hidden sm:inline">|</span>
                <Chip
                  active={singleStyle === 'card'}
                  onClick={() => setSingleStyle('card')}
                  title="Card style — Arabic + translation + chips"
                >
                  Card
                </Chip>
                <Chip
                  active={singleStyle === 'mushaf'}
                  onClick={() => setSingleStyle('mushaf')}
                  title="Mushaf style — page-faithful line breaks"
                >
                  Mushaf
                </Chip>
              </>
            ) : null}
          </ChipRow>

          {layouts.length > 0 ? (
            <ChipRow label="Mushaf">
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
                // In single-ayah Mushaf style, tapping the chip BINDS the
                // active layout for the in-page mushaf rendering. In any
                // other mode, tapping NAVIGATES to the full mushaf page
                // for the current verse.
                if (viewMode === 'single' && singleStyle === 'mushaf') {
                  return (
                    <Chip
                      key={l.slug}
                      active={isActive}
                      onClick={() => setActiveLayoutSlug(l.slug)}
                      title={l.subtitle ?? ''}
                    >
                      {label}
                    </Chip>
                  );
                }
                return (
                  <a
                    key={l.slug}
                    href={`/mushaf/${l.urlSlug ?? l.slug}/page-for/${encodeURIComponent(firstVk)}`}
                    title={l.subtitle ?? ''}
                    className="shrink-0 rounded-full px-3 py-1 text-[11px] sm:text-xs smallcaps tracking-wider transition-colors border border-hairline text-ink hover:bg-paper-200/60 hover:border-leaf/40 hover:text-leaf"
                  >
                    {label} →
                  </a>
                );
              })}
            </ChipRow>
          ) : null}
        </div>
      </div>

      {/* Translator attribution — once per surah, only when translation chosen.
          Dedupe when name === translator (e.g. "Saheeh International"). */}
      {activeTranslation ? (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-4 sm:pt-6">
          <p className="text-[11px] sm:text-xs text-ink-muted text-center leading-relaxed">
            <span className="smallcaps tracking-widest">Translation</span>
            <span className="block sm:inline sm:mx-2 mt-1 sm:mt-0">
              <span>{activeTranslation.name}</span>
              {activeTranslation.translator &&
              activeTranslation.translator !== activeTranslation.name ? (
                <>
                  <span className="mx-2 opacity-50">·</span>
                  <span className="italic">{activeTranslation.translator}</span>
                </>
              ) : null}
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
            direction={singleDirection}
            style={singleStyle}
            layoutSlug={activeLayoutSlug}
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
  direction,
  style,
  layoutSlug,
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

      {/* Touch / pointer swipe surface. Use `key` to force the slide
          animation to replay on each ayah change. */}
      <div
        key={`${v.verseKey}-${style}-${layoutSlug}`}
        className={`${slideClass} ${swipe.dragging ? 'swipe-drag' : 'swipe-spring-back'} touch-pan-y select-none`}
        style={{ ['--swipe-x' as string]: swipe.dragging ? `${swipe.dx}px` : '0px' }}
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
            <AyahMushafLines apiBase={apiBase} verseKey={v.verseKey} layoutSlug={layoutSlug} />
            {translation !== 'none' && translationMap.get(v.verseKey) ? (
              <div className="paper-card p-5 sm:p-7">
                <p className="smallcaps text-leaf text-[10px] tracking-widest mb-2">
                  Translation
                </p>
                <p
                  dir="ltr"
                  lang="en"
                  className="text-[15px] sm:text-base leading-relaxed text-ink/90 max-w-prose mx-auto"
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
            arabic={v.textUthmani}
            translation={translation === 'none' ? null : translationMap.get(v.verseKey) ?? null}
            tafsirSlug={tafsirSlug}
            reciterSlug={reciterSlug}
            apiBase={apiBase}
          />
        )}
      </div>

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

      <p className="text-[10px] smallcaps text-ink-muted/70 tracking-widest text-center pt-2">
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
    onTouchStart: (e) => begin(e.touches[0]?.clientX ?? 0, e.touches[0]?.clientY ?? 0),
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
