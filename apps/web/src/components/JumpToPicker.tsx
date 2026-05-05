'use client';

/**
 * JumpToPicker — floating "go to surah/ayah" affordance.
 *
 * Why it exists: Quranly + Tarteel both bury surah/ayah jumping under nav
 * trees. We collapse it into a single floating button → sheet, available
 * on every reader/listener/mushaf surface. This is the single highest-
 * leverage UX add per JTBD analysis: "I want to land on a specific verse
 * I have in my head, fast, without losing my place."
 *
 * Modes:
 *   - 'reader'  → /read/:surah#:verseKey
 *   - 'mushaf'  → /mushaf/:layout/page-for/:vk (server-side resolves to
 *                  the page that contains that ayah)
 *   - 'listen'  → fires a CustomEvent('qalaam:jump', {detail:{surah,ayah}})
 *                  so /listen can re-bind the player without a navigation
 *
 * Mobile-first: bottom sheet with rounded top, drag-to-dismiss handle,
 * search input, surah grid. Keyboard-accessible (Esc closes, arrow keys
 * navigate the surah list).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import type { ReactNode } from 'react';

interface SurahMeta {
  readonly surah: number;
  readonly nameArabic: string;
  readonly nameEnglish: string;
  readonly nameTransliteration: string;
  readonly verseCount: number;
  readonly revelationPlace: 'makkah' | 'madinah';
}

type Mode = 'reader' | 'mushaf' | 'listen';

interface Props {
  readonly mode: Mode;
  readonly layoutSlug?: string;
  /** Optional, ignored — always uses the same-origin /api proxy. */
  readonly apiBase?: string;
}

export function JumpToPicker({ mode, layoutSlug = 'madani_15' }: Props): ReactNode {
  // Always same-origin via /api proxy — keeps fetches CORS-free.
  const apiBase = resolveApiBase();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [surahs, setSurahs] = useState<readonly SurahMeta[]>([]);
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<SurahMeta | null>(null);
  const [ayah, setAyah] = useState<string>('1');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ayahRef = useRef<HTMLInputElement | null>(null);
  // Active surah index for keyboard navigation in the surah list.
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Fetch surah index lazily — only when the user opens the sheet.
  useEffect(() => {
    if (!open || surahs.length > 0) return;
    const cancelled = { v: false };
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/v1/metadata/surahs`);
        if (!res.ok) return;
        const body = (await res.json()) as { data?: SurahMeta[] };
        if (!cancelled.v && body.data) setSurahs(body.data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled.v = true;
    };
  }, [open, surahs.length, apiBase]);

  // Esc closes; arrow keys navigate the surah list; Enter picks active surah
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      // Arrow nav only applies before a surah is picked
      if (picked) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => {
          const len = filteredLenRef.current;
          if (len === 0) return 0;
          return e.key === 'ArrowDown' ? Math.min(i + 1, len - 1) : Math.max(i - 1, 0);
        });
      } else if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        const item = filteredRef.current[activeIdx];
        if (item) {
          e.preventDefault();
          go(item.surah, 1);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    // Skip auto-focus on mobile so the keyboard doesn't pop up over the
    // sheet immediately on open. Desktop keeps the focus for keyboard nav.
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // Body scroll lock — same posture as TranslationPicker so all bottom
    // sheets behave consistently and the page behind doesn't scroll on
    // touch (iOS rubber-band).
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const sbWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (sbWidth > 0) document.body.style.paddingRight = `${sbWidth.toString()}px`;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  // When a surah is picked, jump focus to the ayah input
  useEffect(() => {
    if (picked) requestAnimationFrame(() => ayahRef.current?.focus());
  }, [picked]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return surahs;
    const q = filter.trim().toLowerCase();
    const qd = Number.parseInt(filter.trim(), 10);
    return surahs.filter((s) => {
      if (Number.isFinite(qd) && qd === s.surah) return true;
      return (
        s.nameEnglish.toLowerCase().includes(q) ||
        s.nameTransliteration.toLowerCase().includes(q) ||
        s.nameArabic.includes(filter.trim())
      );
    });
  }, [surahs, filter]);

  // Keep refs to filtered list + length for the global keydown handler
  // (registered once per `open`); without these the handler would close
  // over a stale `filtered` reference and arrow nav would freeze.
  const filteredRef = useRef<readonly SurahMeta[]>(filtered);
  const filteredLenRef = useRef(filtered.length);
  filteredRef.current = filtered;
  filteredLenRef.current = filtered.length;

  // Reset active index whenever the visible filter set changes
  useEffect(() => {
    setActiveIdx(0);
  }, [filter, surahs]);

  // Scroll the active surah into view when arrow keys move it
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const item = container.querySelector<HTMLLIElement>(`li[data-idx="${activeIdx.toString()}"]`);
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function go(targetSurah: number, targetAyah: number): void {
    const vk = `${targetSurah.toString()}:${targetAyah.toString()}`;
    setOpen(false);
    if (mode === 'mushaf') {
      router.push(`/mushaf/${layoutSlug}/page-for/${encodeURIComponent(vk)}`);
    } else if (mode === 'reader') {
      router.push(`/read/${targetSurah.toString()}#${vk}`);
    } else {
      window.dispatchEvent(
        new CustomEvent('qalaam:jump', { detail: { surah: targetSurah, ayah: targetAyah } }),
      );
    }
    setPicked(null);
    setAyah('1');
    setFilter('');
  }

  function goFromVerseInput(): void {
    if (!picked) return;
    const a = Math.max(1, Math.min(picked.verseCount, Number.parseInt(ayah, 10) || 1));
    go(picked.surah, a);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Jump to surah or verse"
        onClick={() => {
          setOpen(true);
        }}
        className="jump-fab bg-leaf text-paper shadow-leaf/20 fixed bottom-6 right-4 z-40 inline-flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg hover:opacity-95 sm:bottom-8 sm:right-8 sm:px-5 sm:py-3"
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M5 9l7-5 7 5" strokeLinejoin="round" />
          <path d="M5 15l7 5 7-5" strokeLinejoin="round" />
        </svg>
        <span className="smallcaps text-[11px] tracking-widest sm:text-xs">Jump</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jump-title"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              setOpen(false);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
            }}
            className="bg-ink-900/40 absolute inset-0 backdrop-blur-sm"
          />
          <div
            className="bg-paper border-hairline sheet-rise relative w-full rounded-t-2xl border-t shadow-2xl sm:max-w-md sm:rounded-2xl sm:border"
            style={{
              maxHeight: '92dvh',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pb-1 pt-3 sm:hidden">
              <div className="bg-paper-300/80 h-1.5 w-12 rounded-full" aria-hidden />
            </div>

            <header className="flex items-baseline justify-between px-5 pb-3 pt-3 sm:px-6 sm:pt-6">
              <div>
                <p className="smallcaps text-leaf text-[11px] tracking-widest">Jump to</p>
                <h2 id="jump-title" className="font-display text-ink-strong text-xl sm:text-2xl">
                  {picked ? picked.nameEnglish : 'Surah · Verse'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setOpen(false);
                }}
                className="text-ink-muted hover:text-ink -mr-1 p-1"
              >
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            {!picked ? (
              <>
                <div className="px-5 pb-3 sm:px-6">
                  <input
                    ref={inputRef}
                    type="search"
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                    }}
                    placeholder="Surah name or number…"
                    className="border-hairline bg-paper-100 text-ink placeholder:text-ink-muted focus:border-leaf w-full rounded-full border px-4 py-2 text-sm focus:outline-none"
                  />
                </div>
                <ul
                  ref={listRef}
                  className="divide-hairline/60 flex-1 divide-y overflow-y-auto px-2 pb-4 sm:px-3"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                  }}
                  role="listbox"
                >
                  {filtered.length === 0 && surahs.length > 0 ? (
                    <li className="text-ink-muted py-6 text-center text-sm italic">No match.</li>
                  ) : null}
                  {filtered.length === 0 && surahs.length === 0 ? (
                    <li className="text-ink-muted py-6 text-center text-sm italic">Loading…</li>
                  ) : null}
                  {filtered.map((s, idx) => (
                    <li
                      key={s.surah}
                      data-idx={idx.toString()}
                      className={`flex items-stretch gap-1 rounded-md ${
                        idx === activeIdx ? 'ring-leaf/50 bg-paper-100/60 ring-1' : ''
                      }`}
                    >
                      {/* Tap surah → navigate immediately to verse 1.
                          The "+verse" pill on the right opens the inline
                          picker for users who want a specific ayah. */}
                      <button
                        type="button"
                        onClick={() => {
                          go(s.surah, 1);
                        }}
                        className="hover:bg-paper-100 flex flex-1 items-baseline justify-between gap-3 rounded-md px-3 py-2.5 text-left"
                      >
                        <div className="flex min-w-0 items-baseline gap-3">
                          <span className="smallcaps text-ink-muted w-7 shrink-0 font-mono text-[10px] tabular-nums">
                            {s.surah.toString().padStart(3, '0')}
                          </span>
                          <div className="min-w-0">
                            <p className="font-display text-ink truncate text-sm">
                              {s.nameEnglish}
                            </p>
                            <p className="smallcaps text-ink-muted mt-0.5 text-[10px] tracking-widest">
                              {s.verseCount.toString()} verses · {s.revelationPlace}
                            </p>
                          </div>
                        </div>
                        <span
                          dir="rtl"
                          lang="ar"
                          className="font-arabic text-ink-muted shrink-0 text-base"
                          style={{ unicodeBidi: 'plaintext', lineHeight: 1.2 }}
                        >
                          {s.nameArabic}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Pick a specific ayah in ${s.nameEnglish}`}
                        onClick={() => {
                          setPicked(s);
                          setAyah('1');
                        }}
                        className="text-ink-muted hover:bg-paper-100 hover:text-leaf shrink-0 rounded-md px-2"
                        title="Choose a specific ayah"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden
                        >
                          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="px-5 pb-6 sm:px-6">
                <p className="text-ink-muted mb-3 text-xs">
                  Pick a verse — between 1 and {picked.verseCount.toString()}.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    ref={ayahRef}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={picked.verseCount}
                    value={ayah}
                    onChange={(e) => {
                      setAyah(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') goFromVerseInput();
                    }}
                    className="border-hairline bg-paper-100 text-ink-strong focus:border-leaf flex-1 rounded-md border px-4 py-2.5 font-mono text-base tabular-nums focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={goFromVerseInput}
                    className="bg-leaf text-paper smallcaps rounded-full px-5 py-2.5 text-xs tracking-widest hover:opacity-95"
                  >
                    Go →
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                  }}
                  className="smallcaps text-ink-muted hover:text-leaf mt-4 text-xs"
                >
                  ← Pick a different surah
                </button>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Link
                    href={`/read/${picked.surah.toString()}`}
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="border-hairline smallcaps text-ink hover:bg-paper-100 rounded-md border px-3 py-2 text-center text-xs"
                  >
                    Read
                  </Link>
                  <Link
                    href={`/mushaf/${layoutSlug}/page-for/${encodeURIComponent(picked.surah.toString() + ':1')}`}
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="border-hairline smallcaps text-ink hover:bg-paper-100 rounded-md border px-3 py-2 text-center text-xs"
                  >
                    Mushaf
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
