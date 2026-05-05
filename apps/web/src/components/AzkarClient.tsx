'use client';

/**
 * AzkarClient — tap-counter for daily azkar.
 *
 * Per CLAUDE.md adab non-negotiables:
 *   - No streaks, XP, leaderboards
 *   - The count is a reverent prompt, not a score
 *   - localStorage holds in-progress counts; resets on midnight or
 *     manual reset, no server-side tracking
 *
 * UX:
 *   - Category strip (sticky at top of the section, not the page)
 *   - Each dhikr shows: Arabic + transliteration + English + count
 *     button + benefit (collapsed) + source
 *   - Tap count → increments; reaches target → checkmark + soft
 *     gradient; can keep going (some scholars exceed)
 */
import { useEffect, useMemo, useState } from 'react';

import { AZKAR, CATEGORIES } from '../data/azkar.js';
import { renderWithSilentMarks } from '../lib/arabic-render.js';

import type { Dhikr } from '../data/azkar.js';
import type { ReactNode } from 'react';

const STORE_KEY = 'qalaam-azkar-counts-v1';
const STORE_DATE_KEY = 'qalaam-azkar-counts-date';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear().toString()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

export function AzkarClient(): ReactNode {
  // Default to morning if before 4pm local, else evening; user can switch.
  const [activeCat, setActiveCat] = useState<Dhikr['category']>(() => {
    if (typeof window === 'undefined') return 'morning';
    const h = new Date().getHours();
    if (h < 5) return 'wake';
    if (h < 12) return 'morning';
    if (h < 18) return 'evening';
    if (h < 22) return 'general';
    return 'sleep';
  });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate counts on mount; reset if stored date != today.
  useEffect(() => {
    try {
      const today = todayKey();
      const storedDate = window.localStorage.getItem(STORE_DATE_KEY);
      if (storedDate !== today) {
        window.localStorage.setItem(STORE_DATE_KEY, today);
        window.localStorage.removeItem(STORE_KEY);
      } else {
        const raw = window.localStorage.getItem(STORE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, number> | null;
          if (parsed !== null && typeof parsed === 'object') setCounts(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Write-through to localStorage on count changes (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(counts));
    } catch {
      /* quota or private mode — ignore */
    }
  }, [counts, hydrated]);

  const filtered = useMemo(() => AZKAR.filter((z) => z.category === activeCat), [activeCat]);

  function increment(id: string): void {
    setCounts((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function reset(id: string): void {
    setCounts((c) => {
      // Filter out the target key — avoids dynamic-delete which the
      // linter blocks (potentially-unsafe property access pattern).
      const next: Record<string, number> = {};
      for (const k of Object.keys(c)) {
        if (k !== id) next[k] = c[k] ?? 0;
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Category strip — sticky on its own section, not the whole page */}
      <nav
        aria-label="Azkar categories"
        className="bg-paper border-hairline scrollbar-thin sticky top-[64px] z-10 -mx-4 flex gap-1.5 overflow-x-auto border-b px-4 py-3 sm:-mx-6 sm:px-6"
      >
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setActiveCat(c.id);
            }}
            aria-pressed={activeCat === c.id}
            className={`smallcaps shrink-0 rounded-full px-3.5 py-1.5 text-[11px] tracking-widest transition-colors ${
              activeCat === c.id
                ? 'bg-leaf text-paper'
                : 'border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 border'
            }`}
            title={c.hint}
          >
            {c.label}
          </button>
        ))}
      </nav>

      {/* Dhikr list */}
      <ol className="m-0 grid list-none gap-4 p-0">
        {filtered.map((z, idx) => (
          <DhikrCard
            key={z.id}
            dhikr={z}
            index={idx + 1}
            count={counts[z.id] ?? 0}
            onIncrement={() => {
              increment(z.id);
            }}
            onReset={() => {
              reset(z.id);
            }}
          />
        ))}
      </ol>
    </div>
  );
}

function DhikrCard({
  dhikr,
  index,
  count,
  onIncrement,
  onReset,
}: {
  readonly dhikr: Dhikr;
  readonly index: number;
  readonly count: number;
  readonly onIncrement: () => void;
  readonly onReset: () => void;
}): ReactNode {
  const target = dhikr.count;
  const completed = count >= target;
  const progress = target > 0 ? Math.min(1, count / target) : 0;
  const [showBenefit, setShowBenefit] = useState(false);

  return (
    <li
      className="paper-card-raised flex flex-col gap-3 px-5 py-5 sm:px-6 sm:py-6"
      style={{
        borderLeft: completed
          ? '3px solid var(--color-leaf-500, #1b4d5a)'
          : '3px solid transparent',
      }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="smallcaps text-ink-muted text-[10px] tracking-widest">
          <span className="text-leaf">No. {index.toString()}</span> · {dhikr.source}
        </p>
        {target > 1 ? (
          <p className="smallcaps text-leaf text-[10px] tracking-widest">×{target.toString()}</p>
        ) : null}
      </div>

      {/* Arabic */}
      <p
        dir="rtl"
        lang="ar"
        className="font-arabic text-ink-strong text-right text-2xl leading-loose sm:text-3xl"
        style={{
          fontFamily: '"UthmanicHafs", "Amiri Quran", "Noto Naskh Arabic", serif',
          unicodeBidi: 'plaintext',
          fontWeight: 600,
          lineHeight: 1.95,
        }}
      >
        {renderWithSilentMarks(dhikr.arabic, `dh-${dhikr.id}`)}
      </p>

      {/* Transliteration */}
      <p className="text-ink-muted/90 text-sm italic leading-relaxed">{dhikr.transliteration}</p>

      {/* English */}
      <p className="text-ink/90 text-base leading-relaxed sm:text-[17px]">{dhikr.english}</p>

      {/* Benefit (collapsible) */}
      {dhikr.benefit ? (
        <button
          type="button"
          onClick={() => {
            setShowBenefit((s) => !s);
          }}
          className="smallcaps text-leaf hover:text-leaf-dark inline-flex w-fit items-center gap-1.5 text-[11px] tracking-widest"
          aria-expanded={showBenefit}
        >
          {showBenefit ? '− virtue' : '+ virtue'}
        </button>
      ) : null}
      {showBenefit && dhikr.benefit ? (
        <p className="text-ink-muted/85 border-leaf border-l-2 pl-4 text-sm italic leading-relaxed">
          {dhikr.benefit}
        </p>
      ) : null}

      {/* Counter */}
      <div className="border-hairline mt-1 flex items-center justify-between gap-3 border-t pt-4">
        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Tap to count this dhikr (${count.toString()} of ${target.toString()})`}
          className="bg-leaf/10 hover:bg-leaf/20 text-leaf relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors sm:h-16 sm:w-16"
          style={{
            background: completed
              ? 'var(--color-leaf-500, #1b4d5a)'
              : `conic-gradient(var(--color-leaf-500, #1b4d5a) ${(progress * 360).toString()}deg, rgba(27,77,90,0.08) 0deg)`,
          }}
        >
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14 ${
              completed ? 'bg-leaf text-paper' : 'bg-paper text-ink-strong'
            }`}
            style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
          >
            {completed ? (
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="text-base sm:text-lg">{count.toString()}</span>
            )}
          </span>
        </button>
        <p className="text-ink-muted/80 flex-1 text-xs italic leading-snug">
          {completed
            ? `Recited ×${count.toString()}.`
            : `Tap to count · ${count.toString()} of ${target.toString()}`}
        </p>
        {count > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="smallcaps text-ink-muted hover:text-leaf shrink-0 text-[10px] tracking-widest"
          >
            Reset
          </button>
        ) : null}
      </div>
    </li>
  );
}
