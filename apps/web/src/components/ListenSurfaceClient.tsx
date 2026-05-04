'use client';

/**
 * ListenSurfaceClient — interactive layer for /listen.
 *
 * Hydration-safe: starts with deterministic defaults, syncs from localStorage
 * in a useEffect after mount.
 *
 * Mobile-first: surah list scrolls in its own container; reciter list is a
 * stacked card list with active "NOW PLAYING" tag; MiniPlayer fixed at the
 * bottom of the viewport.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { MiniPlayer } from './MiniPlayer.js';

interface SurahMeta {
  surah: number;
  nameArabic: string;
  nameEnglish: string;
  verseCount: number;
  revelationPlace: 'makkah' | 'madinah';
}

interface ReciterItem {
  id: string;
  slug: string;
  name: { en: string; ar: string };
  style: string;
  riwayah: string;
  segmentCoverage: number;
}

interface Props {
  /** Optional, ignored — MiniPlayer uses the same-origin /api proxy. */
  readonly apiBase?: string;
  readonly reciters: readonly ReciterItem[];
  readonly surahs: readonly SurahMeta[];
}

const STORE_R = 'qalaam-listen-reciter';
const STORE_VK = 'qalaam-listen-verse-key';

function arabicNumeral(n: number): string {
  return n.toString().split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d).join('');
}

export function ListenSurfaceClient({ reciters, surahs }: Props): ReactNode {
  // Deterministic defaults — must match what SSR renders.
  const [activeReciter, setActiveReciter] = useState<string>('sudais');
  const [activeVerseKey, setActiveVerseKey] = useState<string>('1:1');
  const [filter, setFilter] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Restore + write-through to localStorage
  useEffect(() => {
    try {
      const r = window.localStorage.getItem(STORE_R);
      const vk = window.localStorage.getItem(STORE_VK);
      if (r && reciters.some((x) => x.slug === r)) setActiveReciter(r);
      if (vk && /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/.test(vk)) setActiveVerseKey(vk);
    } catch {
      /* ignore */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for cross-component jump-to-verse events (from JumpToPicker)
  useEffect(() => {
    const onJump = (e: Event): void => {
      const detail = (e as CustomEvent<{ surah: number; ayah: number }>).detail;
      if (!detail) return;
      const vk = `${detail.surah.toString()}:${detail.ayah.toString()}`;
      setActiveVerseKey(vk);
      try {
        window.localStorage.setItem(STORE_VK, vk);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('qalaam:jump', onJump);
    return () => {
      window.removeEventListener('qalaam:jump', onJump);
    };
  }, []);

  function pickReciter(slug: string): void {
    setActiveReciter(slug);
    if (hydrated) {
      try {
        window.localStorage.setItem(STORE_R, slug);
      } catch {
        /* ignore */
      }
    }
  }

  function pickSurah(surah: number): void {
    const vk = `${surah.toString()}:1`;
    setActiveVerseKey(vk);
    if (hydrated) {
      try {
        window.localStorage.setItem(STORE_VK, vk);
      } catch {
        /* ignore */
      }
    }
  }

  function handleVerseKeyChange(next: string): void {
    setActiveVerseKey(next);
    if (hydrated) {
      try {
        window.localStorage.setItem(STORE_VK, next);
      } catch {
        /* ignore */
      }
    }
  }

  const filteredSurahs = useMemo(() => {
    if (!filter.trim()) return surahs;
    const q = filter.trim().toLowerCase();
    return surahs.filter(
      (s) => s.nameEnglish.toLowerCase().includes(q) || s.nameArabic.includes(filter.trim()),
    );
  }, [surahs, filter]);

  return (
    <div className="grid gap-6 sm:gap-10 md:grid-cols-12">
      {/* Reciter cards */}
      <section aria-labelledby="reciter-heading" className="md:col-span-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 id="reciter-heading" className="font-display text-lg sm:text-2xl tracking-tight">
            Reciter
          </h2>
          <span className="smallcaps text-leaf text-[11px] tracking-widest">
            {reciters.length.toString()} licensed
          </span>
        </div>

        {reciters.length === 0 ? (
          <p className="paper-card p-6 text-sm text-ink-muted italic text-center">
            No reciters available — backend may be unreachable.
          </p>
        ) : (
          <ul className="grid gap-2 grid-cols-1">
            {reciters.map((r) => {
              const active = activeReciter === r.slug;
              return (
                <li key={r.slug}>
                  <button
                    type="button"
                    onClick={() => pickReciter(r.slug)}
                    aria-pressed={active}
                    className={`w-full text-left paper-card flex items-baseline justify-between gap-3 px-4 py-3 transition-colors ${
                      active ? 'shadow-sm' : 'hover:bg-paper-100/70'
                    }`}
                    style={
                      active
                        ? { borderColor: 'var(--color-leaf-500)', borderWidth: '1px' }
                        : undefined
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-display text-sm sm:text-base truncate ${
                          active ? 'text-leaf' : 'text-ink'
                        }`}
                      >
                        {r.name.en}
                        {active ? (
                          <span className="ml-2 smallcaps text-[10px] tracking-widest text-leaf">
                            Now playing
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[10px] sm:text-[11px] smallcaps text-ink-muted tracking-widest mt-0.5">
                        {r.style} · {r.riwayah}
                      </p>
                    </div>
                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-base sm:text-lg text-ink-muted shrink-0"
                      style={{ unicodeBidi: 'plaintext', lineHeight: 1.2 }}
                    >
                      {r.name.ar}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Surah picker */}
      <section aria-labelledby="surah-heading" className="md:col-span-7">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h2 id="surah-heading" className="font-display text-lg sm:text-2xl tracking-tight">
            Surah
          </h2>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by name…"
            className="w-full sm:w-56 rounded-full border border-hairline bg-paper px-4 py-1.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-leaf"
          />
        </div>

        {filteredSurahs.length === 0 ? (
          <p className="paper-card p-6 text-sm text-ink-muted italic text-center">
            No surahs match.
          </p>
        ) : (
          <ul
            className="paper-card divide-y divide-hairline max-h-[60vh] overflow-y-auto"
            role="listbox"
          >
            {filteredSurahs.map((s) => {
              const isActive = activeVerseKey.startsWith(`${s.surah.toString()}:`);
              return (
                <li key={s.surah}>
                  <button
                    type="button"
                    onClick={() => pickSurah(s.surah)}
                    aria-selected={isActive}
                    className={`w-full text-left flex items-baseline justify-between gap-3 px-3 sm:px-4 py-2.5 sm:py-3 transition-colors ${
                      isActive ? 'bg-paper-100' : 'hover:bg-paper-100/60'
                    }`}
                  >
                    <div className="flex items-baseline gap-2 sm:gap-3 min-w-0">
                      <span className="smallcaps font-mono text-[10px] sm:text-[11px] tabular-nums text-ink-muted w-6 sm:w-7 shrink-0">
                        {s.surah.toString().padStart(3, '0')}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`font-display text-sm sm:text-base truncate ${
                            isActive ? 'text-leaf' : 'text-ink'
                          }`}
                        >
                          {s.nameEnglish}
                        </p>
                        <p className="text-[10px] smallcaps text-ink-muted tracking-widest mt-0.5">
                          {s.verseCount.toString()} verses · {s.revelationPlace}
                          {isActive ? ' · playing' : ''}
                        </p>
                      </div>
                    </div>
                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-base sm:text-xl text-ink shrink-0"
                      style={{ unicodeBidi: 'plaintext', lineHeight: 1.2 }}
                    >
                      {s.nameArabic}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[10px] sm:text-[11px] smallcaps text-ink-muted tracking-widest mt-3">
          {arabicNumeral(filteredSurahs.length)} surahs · auto-advance enabled
        </p>
      </section>

      <MiniPlayer
        reciters={reciters}
        reciterSlug={activeReciter}
        verseKey={activeVerseKey}
        onVerseKeyChange={handleVerseKeyChange}
      />
    </div>
  );
}
