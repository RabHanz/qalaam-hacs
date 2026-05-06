'use client';

/**
 * Client-side interactivity layer for /roots:
 *
 *  - live-filter input (Arabic / Buckwalter / lemma)
 *  - sticky alphabet rail with letter counts (clicking a letter
 *    scrolls into the matching tier section)
 *  - 4 collapsible frequency tiers (Foundational expanded by default)
 *  - per-root chip showing letterforms + count + lemma
 *
 * The tier classification is computed server-side; this component
 * just renders + filters. Frequency thresholds (>500, 100-500, 10-100,
 * ≤10) are tuned to the actual distribution of Quranic root counts.
 */
import { useDeferredValue, useMemo, useState } from 'react';

import { canonicalRoot, rootInitialArabic, rootToArabic } from '../lib/buckwalter.js';

import type { ReactNode } from 'react';

interface RootApi {
  readonly root: string;
  readonly count: number;
  readonly topForm: string;
  readonly lemma: string | null;
}

interface Tiers {
  readonly foundational: readonly RootApi[];
  readonly common: readonly RootApi[];
  readonly uncommon: readonly RootApi[];
  readonly rare: readonly RootApi[];
}

interface LetterCount {
  readonly letter: string;
  readonly count: number;
}

interface Props {
  readonly tiers: Tiers;
  readonly lettersWithCount: readonly LetterCount[];
  readonly total: number;
}

interface TierMeta {
  readonly key: keyof Tiers;
  readonly label: string;
  readonly subtitle: string;
  readonly defaultOpen: boolean;
}

const TIER_META: readonly TierMeta[] = [
  {
    key: 'foundational',
    label: 'Foundational',
    subtitle: 'More than 500 occurrences',
    defaultOpen: true,
  },
  {
    key: 'common',
    label: 'Common',
    subtitle: '100 – 500 occurrences',
    defaultOpen: false,
  },
  {
    key: 'uncommon',
    label: 'Uncommon',
    subtitle: '10 – 100 occurrences',
    defaultOpen: false,
  },
  {
    key: 'rare',
    label: 'Rare',
    subtitle: '10 or fewer occurrences',
    defaultOpen: false,
  },
];

function matchesQuery(root: RootApi, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (canonicalRoot(root.root).toLowerCase().includes(q)) return true;
  if (rootToArabic(root.root).includes(query)) return true;
  if (root.topForm.includes(query)) return true;
  if (root.lemma?.toLowerCase().includes(q)) return true;
  return false;
}

function filterTier(tier: readonly RootApi[], query: string, letter: string | null): RootApi[] {
  return tier.filter((r) => {
    if (!matchesQuery(r, query)) return false;
    if (letter) {
      if (rootInitialArabic(r.root) !== letter) return false;
    }
    return true;
  });
}

export function RootsBrowser({ tiers, lettersWithCount, total }: Props): ReactNode {
  const [query, setQuery] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [openTiers, setOpenTiers] = useState<Record<keyof Tiers, boolean>>({
    foundational: true,
    common: false,
    uncommon: false,
    rare: false,
  });
  const deferredQuery = useDeferredValue(query);

  // When a letter is selected, auto-open every tier so its sub-list
  // is visible (otherwise letters in collapsed tiers would seem
  // missing).
  function pickLetter(letter: string | null): void {
    setActiveLetter(letter);
    if (letter) {
      setOpenTiers({ foundational: true, common: true, uncommon: true, rare: true });
    }
  }

  const filtered = useMemo(
    () => ({
      foundational: filterTier(tiers.foundational, deferredQuery, activeLetter),
      common: filterTier(tiers.common, deferredQuery, activeLetter),
      uncommon: filterTier(tiers.uncommon, deferredQuery, activeLetter),
      rare: filterTier(tiers.rare, deferredQuery, activeLetter),
    }),
    [tiers, deferredQuery, activeLetter],
  );

  const totalShown =
    filtered.foundational.length +
    filtered.common.length +
    filtered.uncommon.length +
    filtered.rare.length;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-32 sm:px-6 sm:pb-24">
      {/* SEARCH */}
      <section className="mt-12 sm:mt-16">
        <label
          htmlFor="root-search"
          className="text-ink-faint mb-3 block text-xs uppercase tracking-widest"
        >
          Find a root
        </label>
        <div className="relative">
          <input
            id="root-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Type letterforms (ر ح م), Buckwalter (rHm), or a lemma…"
            className="bg-surface border-hairline focus:border-leaf-500 focus:ring-leaf-500/20 text-ink-strong placeholder:text-ink-faint w-full rounded-xl border px-4 py-3.5 text-sm transition-colors focus:outline-none focus:ring-2 sm:text-base"
          />
          {query.length > 0 ? (
            <button
              onClick={() => {
                setQuery('');
              }}
              className="text-ink-faint hover:text-ink-strong absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs transition-colors"
              aria-label="Clear search"
            >
              clear
            </button>
          ) : null}
        </div>
        <p className="text-ink-faint mt-3 text-xs tabular-nums">
          {totalShown.toLocaleString()} of {total.toLocaleString()} roots
          {activeLetter ? ` · letter ${activeLetter}` : ''}
          {deferredQuery ? ` · matching "${deferredQuery}"` : ''}
        </p>
      </section>

      {/* ALPHABET RAIL */}
      <section className="bg-bg/95 border-hairline/60 sticky top-0 z-10 -mx-4 mt-8 border-b px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="scrollbar-thin flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => {
              pickLetter(null);
            }}
            className={[
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              activeLetter === null
                ? 'bg-leaf-500/10 text-leaf-700 ring-leaf-500/30 ring-1'
                : 'text-ink-muted hover:text-ink-strong',
            ].join(' ')}
            aria-pressed={activeLetter === null}
          >
            all
          </button>
          {lettersWithCount.map(({ letter, count }) => {
            const enabled = count > 0;
            const isActive = activeLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => {
                  if (enabled) pickLetter(isActive ? null : letter);
                }}
                disabled={!enabled}
                className={[
                  'inline-flex shrink-0 flex-col items-center justify-center rounded-full px-3 py-1.5 transition-colors',
                  isActive
                    ? 'bg-gold-500/15 ring-gold-500/40 text-gold-700 ring-1'
                    : enabled
                      ? 'text-ink-strong hover:bg-surface'
                      : 'text-ink-faint/40 cursor-not-allowed',
                ].join(' ')}
                aria-pressed={isActive}
                aria-label={`${count.toString()} roots starting with ${letter}`}
              >
                <span
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-lg leading-none"
                  style={{ fontFeatureSettings: '"liga" 0, "calt" 0' }}
                >
                  {letter}
                </span>
                <span className="mt-0.5 text-[9px] tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TIERED CATALOG */}
      <div className="mt-8 space-y-4">
        {TIER_META.map((meta) => {
          const list = filtered[meta.key];
          const isOpen = openTiers[meta.key];
          return (
            <section
              key={meta.key}
              id={`tier-${meta.key}`}
              className="border-hairline bg-surface overflow-hidden rounded-2xl border"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenTiers((prev) => ({ ...prev, [meta.key]: !prev[meta.key] }));
                }}
                className="hover:bg-surface-elevated flex w-full items-center justify-between gap-4 px-5 py-4 transition-colors sm:px-6"
                aria-expanded={isOpen}
                aria-controls={`tier-list-${meta.key}`}
              >
                <div className="flex min-w-0 items-baseline gap-3 sm:gap-4">
                  <span className="font-display text-ink-strong text-base font-light sm:text-lg">
                    {meta.label}
                  </span>
                  <span className="text-ink-faint truncate text-xs">{meta.subtitle}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-ink-muted text-xs tabular-nums">
                    {list.length.toLocaleString()}
                  </span>
                  <span
                    aria-hidden="true"
                    className={[
                      'text-ink-muted text-sm transition-transform',
                      isOpen ? 'rotate-180' : '',
                    ].join(' ')}
                  >
                    ▾
                  </span>
                </div>
              </button>
              {isOpen ? (
                <div
                  id={`tier-list-${meta.key}`}
                  className="border-hairline border-t px-3 py-4 sm:px-4"
                >
                  {list.length === 0 ? (
                    <p className="text-ink-faint px-3 py-6 text-center text-sm">
                      No roots in this tier match your filter.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {list.map((r) => (
                        <li key={r.root}>
                          <a
                            href={`/concordance/root/${encodeURIComponent(r.root)}`}
                            className="hover:bg-surface-elevated group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors"
                          >
                            <div className="flex min-w-0 items-baseline gap-2.5">
                              <span
                                dir="rtl"
                                lang="ar"
                                className="font-arabic text-ink-strong group-hover:text-leaf-700 shrink-0 text-xl leading-none tracking-[0.15em] transition-colors sm:text-2xl"
                                style={{ fontFeatureSettings: '"liga" 0, "calt" 0' }}
                              >
                                {rootToArabic(r.root)}
                              </span>
                              {r.lemma ? (
                                <span
                                  dir="rtl"
                                  lang="ar"
                                  className="font-arabic text-ink-muted truncate text-xs"
                                  title={r.lemma}
                                >
                                  {r.lemma}
                                </span>
                              ) : null}
                            </div>
                            <span className="text-gold-700/80 shrink-0 text-[10px] font-medium tabular-nums">
                              {r.count.toLocaleString()}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}
