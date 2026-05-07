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

import { readPlaybackSnapshot, writeReciter, writeVerseKey } from '../lib/playback-store.js';

import { MiniPlayer } from './MiniPlayer.js';
import { SaveSurahOffline } from './SaveSurahOffline.js';

import type { ReactNode } from 'react';

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

function arabicNumeral(n: number): string {
  return n
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)
    .join('');
}

export function ListenSurfaceClient({ reciters, surahs }: Props): ReactNode {
  // Deterministic defaults — must match what SSR renders.
  const [activeReciter, setActiveReciter] = useState<string>('sudais');
  const [activeVerseKey, setActiveVerseKey] = useState<string>('1:1');
  const [filter, setFilter] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Restore from canonical playback store (shared with /read so the
  // user's reciter + verse selection carries between the two pages).
  useEffect(() => {
    const snap = readPlaybackSnapshot();
    if (snap.reciterSlug && reciters.some((x) => x.slug === snap.reciterSlug)) {
      setActiveReciter(snap.reciterSlug);
    }
    if (snap.verseKey) setActiveVerseKey(snap.verseKey);
    setHydrated(true);
    // Reciters list is stable for the page lifetime; deps left empty
    // so we restore once on mount and don't re-trigger.
  }, []);

  // Listen for cross-component jump-to-verse events (from JumpToPicker)
  useEffect(() => {
    const onJump = (e: Event): void => {
      const ce = e as CustomEvent<{ surah: number; ayah: number }>;
      const { surah, ayah } = ce.detail;
      const vk = `${surah.toString()}:${ayah.toString()}`;
      setActiveVerseKey(vk);
      writeVerseKey(vk);
      try {
        // Reflect the verse-key in the URL hash so the page can be
        // shared/refreshed without losing position. replaceState avoids
        // polluting browser history (the user is just choosing where to
        // listen, not navigating).
        const newUrl = `${window.location.pathname}${window.location.search}#${vk}`;
        window.history.replaceState(null, '', newUrl);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('qalaam:jump', onJump);
    return () => {
      window.removeEventListener('qalaam:jump', onJump);
    };
  }, []);

  // Hydrate verse-key from URL hash if present (overrides localStorage)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (/^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/.test(hash)) {
      setActiveVerseKey(hash);
    }
  }, []);

  function pickReciter(slug: string): void {
    setActiveReciter(slug);
    if (hydrated) writeReciter(slug);
  }

  function pickSurah(surah: number): void {
    const vk = `${surah.toString()}:1`;
    setActiveVerseKey(vk);
    if (hydrated) writeVerseKey(vk);
  }

  function handleVerseKeyChange(next: string): void {
    setActiveVerseKey(next);
    if (hydrated) writeVerseKey(next);
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
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="reciter-heading" className="font-display text-lg tracking-tight sm:text-2xl">
            Reciter
          </h2>
          <span className="smallcaps text-leaf text-[11px] tracking-widest">
            {reciters.length.toString()} licensed
          </span>
        </div>

        {reciters.length === 0 ? (
          <p className="paper-card text-ink-muted p-6 text-center text-sm italic">
            No reciters available — backend may be unreachable.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {reciters.map((r) => {
              const active = activeReciter === r.slug;
              return (
                <li key={r.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      pickReciter(r.slug);
                    }}
                    aria-pressed={active}
                    className={`paper-card flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left transition-colors ${
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
                        className={`font-display truncate text-sm sm:text-base ${
                          active ? 'text-leaf' : 'text-ink'
                        }`}
                      >
                        {r.name.en}
                        {active ? (
                          <span className="smallcaps text-leaf ml-2 text-[10px] tracking-widest">
                            Now playing
                          </span>
                        ) : null}
                      </p>
                      <p className="smallcaps text-ink-muted mt-0.5 text-[10px] tracking-widest sm:text-[11px]">
                        {r.style} · {r.riwayah}
                      </p>
                    </div>
                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-ink-muted shrink-0 text-base sm:text-lg"
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
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="surah-heading" className="font-display text-lg tracking-tight sm:text-2xl">
            Surah
          </h2>
          <input
            type="search"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
            }}
            placeholder="Search by name…"
            className="border-hairline bg-paper text-ink placeholder:text-ink-muted focus:border-leaf w-full rounded-full border px-4 py-1.5 text-xs focus:outline-none sm:w-56 sm:text-sm"
          />
        </div>

        {filteredSurahs.length === 0 ? (
          <p className="paper-card text-ink-muted p-6 text-center text-sm italic">
            No surahs match.
          </p>
        ) : (
          <ul
            className="paper-card divide-hairline max-h-[60vh] divide-y overflow-y-auto"
            role="listbox"
          >
            {filteredSurahs.map((s) => {
              const isActive = activeVerseKey.startsWith(`${s.surah.toString()}:`);
              return (
                <li key={s.surah}>
                  <button
                    type="button"
                    onClick={() => {
                      pickSurah(s.surah);
                    }}
                    aria-selected={isActive}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3 ${
                      isActive ? 'bg-paper-100' : 'hover:bg-paper-100/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
                      <span className="smallcaps text-ink-muted w-6 shrink-0 font-mono text-[10px] tabular-nums sm:w-7 sm:text-[11px]">
                        {s.surah.toString().padStart(3, '0')}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`font-display truncate text-sm sm:text-base ${
                            isActive ? 'text-leaf' : 'text-ink'
                          }`}
                        >
                          {s.nameEnglish}
                        </p>
                        <p className="smallcaps text-ink-muted mt-0.5 text-[10px] tracking-widest">
                          {s.verseCount.toString()} verses · {s.revelationPlace}
                          {isActive ? ' · playing' : ''}
                        </p>
                      </div>
                    </div>
                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-ink shrink-0 text-base sm:text-xl"
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="smallcaps text-ink-muted text-[10px] tracking-widest sm:text-[11px]">
            {arabicNumeral(filteredSurahs.length)} surahs · auto-advance enabled
          </p>
          {(() => {
            const activeSurah = Number.parseInt(activeVerseKey.split(':')[0] ?? '0', 10);
            if (!Number.isFinite(activeSurah) || activeSurah < 1 || activeSurah > 114) return null;
            return <SaveSurahOffline surah={activeSurah} reciterSlug={activeReciter} />;
          })()}
        </div>
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
