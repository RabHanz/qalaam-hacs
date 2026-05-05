'use client';

/**
 * ReaderControls — sticky chip-bar at the top of /read/:surah.
 *
 * Three pickers:
 *   1. Translation (Pickthall · Saheeh International · None — show only Arabic)
 *   2. Reciter (14 ingested QUL reciters)
 *   3. Mushaf-page mode toggle (jumps to /mushaf/:layout/:page route)
 *
 * Persistence: both translation and reciter live in localStorage so the user's
 * choice survives navigation. The selected values are also reflected in the
 * URL search params (`?t=pickthall&r=sudais`) so deep-links stay reproducible.
 *
 * Mobile-first: chip groups scroll horizontally on small screens; sticky header
 * collapses padding below 640px.
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { ReactNode } from 'react';

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

interface ReaderControlsProps {
  readonly translations: readonly TranslationItem[];
  readonly reciters: readonly ReciterItem[];
  readonly defaultTranslation?: string;
  readonly defaultReciter?: string;
}

const STORE_T = 'qalaam-translation';
const STORE_R = 'qalaam-reciter';

export function ReaderControls({
  translations,
  reciters,
  defaultTranslation = 'pickthall',
  defaultReciter = 'sudais',
}: ReaderControlsProps): ReactNode {
  const router = useRouter();
  const params = useSearchParams();

  const initialT = params.get('t') ?? defaultTranslation;
  const initialR = params.get('r') ?? defaultReciter;

  const [translation, setTranslation] = useState<string>(initialT);
  const [reciter, setReciter] = useState<string>(initialR);

  // Restore from localStorage on first mount (only if URL didn't pin a choice)
  useEffect(() => {
    if (!params.get('t')) {
      try {
        const v = window.localStorage.getItem(STORE_T);
        if (v) setTranslation(v);
      } catch {
        /* ignore */
      }
    }
    if (!params.get('r')) {
      try {
        const v = window.localStorage.getItem(STORE_R);
        if (v) setReciter(v);
      } catch {
        /* ignore */
      }
    }
    // Run only on mount — the persisted-prefs read is intentionally
    // a one-shot bootstrap, not a reactive subscription.
  }, []);

  function pickTranslation(slug: string): void {
    setTranslation(slug);
    try {
      window.localStorage.setItem(STORE_T, slug);
    } catch {
      /* ignore */
    }
    const next = new URLSearchParams(params.toString());
    if (slug === 'none') next.delete('t');
    else next.set('t', slug);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  function pickReciter(slug: string): void {
    setReciter(slug);
    try {
      window.localStorage.setItem(STORE_R, slug);
    } catch {
      /* ignore */
    }
    const next = new URLSearchParams(params.toString());
    next.set('r', slug);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="border-hairline bg-paper-100/85 sticky top-[60px] z-20 border-b backdrop-blur-md sm:top-[68px]">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-3 sm:px-6">
        {/* Translation picker */}
        <div className="scrollbar-thin -mx-4 flex items-center gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <span className="smallcaps text-leaf shrink-0 text-[11px] tracking-widest">
            Translation
          </span>
          <div className="flex min-w-max items-center gap-1.5">
            {[{ slug: 'none', name: 'None — Arabic only', translator: '' }, ...translations].map(
              (t) => {
                const active = translation === t.slug;
                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => {
                      pickTranslation(t.slug);
                    }}
                    className={`smallcaps shrink-0 rounded-full border px-3 py-1 text-xs tracking-wider transition-colors ${
                      active
                        ? 'bg-leaf text-paper border-leaf'
                        : 'border-hairline text-ink hover:bg-paper-200/60'
                    }`}
                    title={t.translator || ''}
                  >
                    {t.slug === 'none' ? 'Arabic only' : t.name.replace(/^The /, '')}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Reciter picker */}
        <div className="scrollbar-thin -mx-4 flex items-center gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <span className="smallcaps text-leaf shrink-0 text-[11px] tracking-widest">Reciter</span>
          <div className="flex min-w-max items-center gap-1.5">
            {reciters.map((r) => {
              const active = reciter === r.slug;
              return (
                <button
                  key={r.slug}
                  type="button"
                  onClick={() => {
                    pickReciter(r.slug);
                  }}
                  className={`smallcaps shrink-0 rounded-full border px-3 py-1 text-xs tracking-wider transition-colors ${
                    active
                      ? 'bg-leaf text-paper border-leaf'
                      : 'border-hairline text-ink hover:bg-paper-200/60'
                  }`}
                  title={`${r.name.en} · ${r.style}`}
                >
                  {r.name.en.replace(/^.* /, '').replace(/^al-/, '')}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function getActiveTranslation(
  searchParams: URLSearchParams,
  defaultSlug = 'pickthall',
): string {
  const t = searchParams.get('t');
  if (t === 'none') return 'none';
  return t ?? defaultSlug;
}

export function getActiveReciter(searchParams: URLSearchParams, defaultSlug = 'sudais'): string {
  return searchParams.get('r') ?? defaultSlug;
}
