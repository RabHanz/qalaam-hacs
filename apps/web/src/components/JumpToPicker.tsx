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
import type { ReactNode } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

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

export function JumpToPicker({
  mode,
  layoutSlug = 'madani_15',
}: Props): ReactNode {
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

  // Fetch surah index lazily — only when the user opens the sheet.
  useEffect(() => {
    if (!open || surahs.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/v1/metadata/surahs`);
        if (!res.ok) return;
        const body = (await res.json()) as { data: SurahMeta[] };
        if (!cancelled) setSurahs(body.data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, surahs.length, apiBase]);

  // Esc closes; focus the search box on open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
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

  function go(): void {
    if (!picked) return;
    const a = Math.max(1, Math.min(picked.verseCount, Number.parseInt(ayah, 10) || 1));
    const vk = `${picked.surah.toString()}:${a.toString()}`;
    setOpen(false);
    if (mode === 'mushaf') {
      router.push(`/mushaf/${layoutSlug}/page-for/${encodeURIComponent(vk)}`);
    } else if (mode === 'reader') {
      router.push(`/read/${picked.surah.toString()}#${vk}`);
    } else {
      window.dispatchEvent(
        new CustomEvent('qalaam:jump', { detail: { surah: picked.surah, ayah: a } }),
      );
    }
    // Reset selection for next open
    setPicked(null);
    setAyah('1');
    setFilter('');
  }

  return (
    <>
      <button
        type="button"
        aria-label="Jump to surah or verse"
        onClick={() => setOpen(true)}
        className="jump-fab fixed z-40 bottom-6 right-4 sm:bottom-8 sm:right-8 inline-flex items-center gap-2 rounded-full bg-leaf text-paper px-4 py-2.5 sm:px-5 sm:py-3 shadow-lg shadow-leaf/20 hover:opacity-95"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 9l7-5 7 5" strokeLinejoin="round" />
          <path d="M5 15l7 5 7-5" strokeLinejoin="round" />
        </svg>
        <span className="smallcaps text-[11px] sm:text-xs tracking-widest">Jump</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jump-title"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
          />
          <div
            className="relative w-full sm:max-w-md sm:rounded-2xl bg-paper border-t sm:border border-hairline shadow-2xl rounded-t-2xl sheet-rise"
            style={{ maxHeight: '92vh' }}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-paper-300/60" aria-hidden />
            </div>

            <header className="px-5 sm:px-6 pt-3 sm:pt-6 pb-3 flex items-baseline justify-between">
              <div>
                <p className="smallcaps text-leaf text-[11px] tracking-widest">Jump to</p>
                <h2 id="jump-title" className="font-display text-xl sm:text-2xl text-ink-strong">
                  {picked ? picked.nameEnglish : 'Surah · Verse'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-ink-muted hover:text-ink p-1 -mr-1"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            {!picked ? (
              <>
                <div className="px-5 sm:px-6 pb-3">
                  <input
                    ref={inputRef}
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Surah name or number…"
                    className="w-full rounded-full border border-hairline bg-paper-100 px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-leaf"
                  />
                </div>
                <ul
                  className="overflow-y-auto px-2 sm:px-3 pb-4 divide-y divide-hairline/60"
                  style={{ maxHeight: 'calc(92vh - 180px)' }}
                  role="listbox"
                >
                  {filtered.length === 0 && surahs.length > 0 ? (
                    <li className="text-center text-sm text-ink-muted italic py-6">No match.</li>
                  ) : null}
                  {filtered.length === 0 && surahs.length === 0 ? (
                    <li className="text-center text-sm text-ink-muted italic py-6">Loading…</li>
                  ) : null}
                  {filtered.map((s) => (
                    <li key={s.surah}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(s);
                          setAyah('1');
                        }}
                        className="w-full text-left flex items-baseline justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-paper-100"
                      >
                        <div className="flex items-baseline gap-3 min-w-0">
                          <span className="smallcaps font-mono text-[10px] tabular-nums text-ink-muted w-7 shrink-0">
                            {s.surah.toString().padStart(3, '0')}
                          </span>
                          <div className="min-w-0">
                            <p className="font-display text-sm text-ink truncate">{s.nameEnglish}</p>
                            <p className="text-[10px] smallcaps text-ink-muted tracking-widest mt-0.5">
                              {s.verseCount.toString()} verses · {s.revelationPlace}
                            </p>
                          </div>
                        </div>
                        <span
                          dir="rtl"
                          lang="ar"
                          className="font-arabic text-base text-ink-muted shrink-0"
                          style={{ unicodeBidi: 'plaintext', lineHeight: 1.2 }}
                        >
                          {s.nameArabic}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="px-5 sm:px-6 pb-6">
                <p className="text-xs text-ink-muted mb-3">
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
                    onChange={(e) => setAyah(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') go();
                    }}
                    className="flex-1 rounded-md border border-hairline bg-paper-100 px-4 py-2.5 text-base font-mono tabular-nums text-ink-strong focus:outline-none focus:border-leaf"
                  />
                  <button
                    type="button"
                    onClick={go}
                    className="rounded-full bg-leaf text-paper px-5 py-2.5 smallcaps text-xs tracking-widest hover:opacity-95"
                  >
                    Go →
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="mt-4 text-xs smallcaps text-ink-muted hover:text-leaf"
                >
                  ← Pick a different surah
                </button>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Link
                    href={`/read/${picked.surah.toString()}`}
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-hairline px-3 py-2 text-xs smallcaps text-center text-ink hover:bg-paper-100"
                  >
                    Read
                  </Link>
                  <Link
                    href={`/mushaf/${layoutSlug}/page-for/${encodeURIComponent(picked.surah.toString() + ':1')}`}
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-hairline px-3 py-2 text-xs smallcaps text-center text-ink hover:bg-paper-100"
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

