'use client';

/**
 * MutashabihatDrillClient — interactive side-by-side drill UI.
 *
 * Two pedagogical framings, picked by the user:
 *
 *   1. EMPHASIS = "shared" (default — orthodox hifz convention)
 *      Bolds the SHARED RUN — the long phrase both verses have in
 *      common. That's the spine where iltibās (confusion) happens:
 *      the brain auto-completes from the shared phrase into the wrong
 *      verse. Surfacing the spine trains the eye to spot the fork.
 *      Pairs naturally with "Cover partner" mode.
 *
 *   2. EMPHASIS = "differences"
 *      Bolds the UNIQUE words — each verse's distinguishing tail.
 *      Best for parent-led "spot the difference" drilling and quick
 *      "which verse am I looking at?" recognition.
 *
 *   3. EMPHASIS = "plain"
 *      No emphasis at all. Just two verses, plain Arabic, side by side.
 *      For users who want to read without scaffolding.
 *
 * Word alignment is via greedy LCS on diacritic-stripped, alif-normalised
 * tokens so confusable typographic variants (yāʾ-tahtaniyyah vs alif
 * maqsūrah, alif variants, tatweel) collapse to the same surface form.
 *
 * Persistence: emphasis mode lives in localStorage so the user's
 * preference survives across visits.
 *
 * Keyboard: S / D / P swap modes; C toggles Cover partner; arrow-keys
 * cycle other partners.
 *
 * Per memory `feedback_quranic_authenticity.md`: the verse text comes
 * straight from /v1/verses/by_key/:vk (textUthmani column from the
 * authoritative qalaam_v1_verses table). Never hand-typed.
 */
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { renderWithSilentMarks } from '../lib/arabic-render.js';

import type { ReactNode } from 'react';

interface Verse {
  readonly verseKey: string;
  readonly textUthmani: string;
}

interface Candidate {
  readonly verseKey: string;
  readonly score: number;
}

interface Props {
  readonly primary: Verse;
  readonly partner: Verse;
  readonly partnerCandidates: readonly Candidate[];
}

// ---------------------------------------------------------------- Tokenisation

/**
 * Strip Arabic diacritics + presentation marks so word-level diff can
 * match across mushaf typographic variants (e.g., يَـٰبَنِى vs يَا بَنِى
 * resolves to the same surface form).
 */
function normalize(s: string): string {
  return (
    s
      .replace(/[ً-ٰٟۖ-ۭ]/g, '') // tashkeel + presentation
      .replace(/[ٱآأإ]/g, 'ا') // alif variants → bare alif
      .replace(/ـ/g, '') // tatweel
      // ZWSP / ZWNJ / ZWJ / LRM / RLM — strip via String.fromCharCode
      // build to satisfy no-irregular-whitespace + no-misleading-character-class.
      .replace(
        new RegExp(
          [0x200b, 0x200c, 0x200d, 0x200e, 0x200f].map((c) => String.fromCodePoint(c)).join('|'),
          'g',
        ),
        '',
      )
      .normalize('NFC')
      .trim()
  );
}

function tokenize(verse: string): readonly string[] {
  return verse
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .filter((t) => !/^[٠-٩۰-۹]+$/.test(t)); // ayah numerals
}

type DiffMark = 'shared' | 'changed';

interface AlignedToken {
  readonly token: string;
  readonly mark: DiffMark;
}

/**
 * Greedy LCS-based alignment. Returns parallel arrays where each item
 * is { token, mark } — mark ∈ "shared" | "changed". Used to mark diff
 * highlights independently for the left and right verse.
 */
function diffTokens(
  a: readonly string[],
  b: readonly string[],
): { left: readonly AlignedToken[]; right: readonly AlignedToken[] } {
  const an = a.map(normalize);
  const bn = b.map(normalize);
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0) as number[]);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const aw = an[i - 1] ?? '';
      const bw = bn[j - 1] ?? '';
      if (aw === bw) {
        const prev = dp[i - 1]?.[j - 1] ?? 0;
        const row = dp[i];
        if (row) row[j] = prev + 1;
      } else {
        const up = dp[i - 1]?.[j] ?? 0;
        const left = dp[i]?.[j - 1] ?? 0;
        const row = dp[i];
        if (row) row[j] = Math.max(up, left);
      }
    }
  }
  const leftMark = new Array<DiffMark>(m).fill('changed');
  const rightMark = new Array<DiffMark>(n).fill('changed');
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    const aw = an[i - 1] ?? '';
    const bw = bn[j - 1] ?? '';
    if (aw === bw) {
      leftMark[i - 1] = 'shared';
      rightMark[j - 1] = 'shared';
      i--;
      j--;
    } else if ((dp[i - 1]?.[j] ?? 0) >= (dp[i]?.[j - 1] ?? 0)) {
      i--;
    } else {
      j--;
    }
  }
  return {
    left: a.map((token, idx) => ({ token, mark: leftMark[idx] ?? 'changed' })),
    right: b.map((token, idx) => ({ token, mark: rightMark[idx] ?? 'changed' })),
  };
}

// ---------------------------------------------------------------- Emphasis modes

type EmphasisMode = 'shared' | 'differences' | 'plain';

interface EmphasisDef {
  readonly id: EmphasisMode;
  readonly label: string;
  readonly hint: string;
  readonly key: string; // keyboard shortcut character
  readonly description: string; // shown in the legend
}

const EMPHASIS_MODES: readonly EmphasisDef[] = [
  {
    id: 'shared',
    label: 'Shared run',
    hint: 'Bold the spine where confusion happens',
    key: 'S',
    description:
      'The shared phrase is the trap — the brain auto-completes from it into the wrong verse. Train your eye to see the spine, then notice where each verse forks.',
  },
  {
    id: 'differences',
    label: 'Differences',
    hint: 'Bold each verse’s unique words',
    key: 'D',
    description:
      'Each verse’s unique words pop. Best for quick recognition: which verse is this, and what tells me apart from its mutashabih?',
  },
  {
    id: 'plain',
    label: 'Plain reading',
    hint: 'No emphasis — read the verse straight',
    key: 'P',
    description: 'Both verses rendered evenly, no scaffolding. For pure recitation comparison.',
  },
];

const STORE_EMPHASIS = 'qalaam-mutashabihat-emphasis';
const STORE_COVER = 'qalaam-mutashabihat-cover';

function isValidEmphasis(s: string | null): s is EmphasisMode {
  return s === 'shared' || s === 'differences' || s === 'plain';
}

// ---------------------------------------------------------------- Component

export function MutashabihatDrillClient({ primary, partner, partnerCandidates }: Props): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const [coverPartner, setCoverPartner] = useState(false);
  const [emphasis, setEmphasis] = useState<EmphasisMode>('shared');
  const [hydrated, setHydrated] = useState(false);

  // Restore persisted preferences on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORE_EMPHASIS);
      if (isValidEmphasis(stored)) setEmphasis(stored);
      if (window.localStorage.getItem(STORE_COVER) === '1') setCoverPartner(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Write-through on user changes (after hydration so we don't double-write).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORE_EMPHASIS, emphasis);
      window.localStorage.setItem(STORE_COVER, coverPartner ? '1' : '0');
    } catch {
      /* ignore quota */
    }
  }, [emphasis, coverPartner, hydrated]);

  // Keyboard shortcuts (only when no input is focused).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        setEmphasis('shared');
      } else if (k === 'd') {
        setEmphasis('differences');
      } else if (k === 'p') {
        setEmphasis('plain');
      } else if (k === 'c') {
        setCoverPartner((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const { leftTokens, rightTokens, sharedCount, changedCount } = useMemo(() => {
    const a = tokenize(primary.textUthmani);
    const b = tokenize(partner.textUthmani);
    const aligned = diffTokens(a, b);
    const shared = aligned.left.filter((t) => t.mark === 'shared').length;
    const changed = aligned.left.length + aligned.right.length - shared * 2;
    return {
      leftTokens: aligned.left,
      rightTokens: aligned.right,
      sharedCount: shared,
      changedCount: changed,
    };
  }, [primary.textUthmani, partner.textUthmani]);

  function switchPartner(vk: string): void {
    if (vk === partner.verseKey) return;
    router.push(`${pathname}?partner=${encodeURIComponent(vk)}`, { scroll: false });
  }

  // EMPHASIS_MODES has at least one entry by construction, so the
  // [0] fallback is safe — but ESLint disallows non-null assertions,
  // so guard with an explicit narrowing fallback.
  const activeMode: EmphasisDef = EMPHASIS_MODES.find((m) => m.id === emphasis) ??
    EMPHASIS_MODES[0] ?? {
      id: 'shared',
      label: 'Shared run',
      hint: '',
      key: 'S',
      description: '',
    };

  return (
    <div className="space-y-6">
      {/* Drill controls — top row */}
      <div className="border-hairline flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="smallcaps text-ink-muted text-[11px] tracking-widest">
            <span className="text-leaf">{leftTokens.length.toString()}</span>
            <span className="opacity-50"> ↔ </span>
            <span className="text-leaf">{rightTokens.length.toString()}</span>
            {' words · '}
            <span className="text-leaf">{sharedCount.toString()}</span>
            {' shared · '}
            <span className="text-[color:var(--color-gold-500,#b6862c)]">
              {changedCount.toString()}
            </span>
            {' unique'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCoverPartner((c) => !c);
          }}
          title="Cover the partner verse to drill from memory · keyboard: C"
          className={`smallcaps rounded-full px-4 py-1.5 text-[11px] tracking-widest transition-colors ${
            coverPartner
              ? 'bg-leaf text-paper'
              : 'border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 border'
          }`}
        >
          {coverPartner ? 'Reveal partner' : 'Cover partner'}{' '}
          <span className="opacity-50">· C</span>
        </button>
      </div>

      {/* Emphasis-mode segmented control */}
      <EmphasisControl mode={emphasis} onChange={setEmphasis} />

      {/* Side-by-side diff. Mobile stacks vertical, desktop two-column. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <VerseColumn
          verseKey={primary.verseKey}
          tokens={leftTokens}
          covered={false}
          accent="leaf"
          emphasis={emphasis}
        />
        <VerseColumn
          verseKey={partner.verseKey}
          tokens={rightTokens}
          covered={coverPartner}
          accent="gold"
          emphasis={emphasis}
        />
      </div>

      {/* Mode legend — explains WHY each framing is useful */}
      <ModeLegend mode={activeMode} />

      {/* Other partners */}
      {partnerCandidates.length > 1 ? (
        <div className="border-hairline mt-2 border-t pt-4">
          <p className="smallcaps text-ink-muted mb-2 text-[10px] tracking-widest">
            Other similar verses
          </p>
          <div className="flex flex-wrap gap-2">
            {partnerCandidates.map((c) => {
              const isActive = c.verseKey === partner.verseKey;
              return (
                <button
                  key={c.verseKey}
                  type="button"
                  onClick={() => {
                    switchPartner(c.verseKey);
                  }}
                  className={`smallcaps inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] tracking-widest transition-colors ${
                    isActive
                      ? 'bg-leaf text-paper'
                      : 'border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 border'
                  }`}
                >
                  <span className="font-mono tabular-nums">{c.verseKey}</span>
                  <span className="opacity-70">{c.score.toString()}%</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Source attribution */}
      <p className="text-ink-muted/70 mt-4 text-center text-[11px] italic">
        Source: QUL mutashabihat-v2 corpus · permissive-with-credit · keyboard shortcuts S · D · P ·
        C
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Sub-components

function EmphasisControl({
  mode,
  onChange,
}: {
  readonly mode: EmphasisMode;
  readonly onChange: (m: EmphasisMode) => void;
}): ReactNode {
  return (
    <div role="radiogroup" aria-label="Emphasis mode" className="flex flex-wrap items-center gap-2">
      <span className="smallcaps text-ink-muted shrink-0 text-[10px] tracking-widest">
        Emphasis
      </span>
      <div className="border-hairline inline-flex shrink-0 rounded-full border p-0.5">
        {EMPHASIS_MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={`${m.hint} · keyboard: ${m.key}`}
              onClick={() => {
                onChange(m.id);
              }}
              className={`smallcaps inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] tracking-widest transition-all duration-200 ${
                active ? 'bg-leaf text-paper shadow-sm' : 'text-ink-muted hover:text-leaf'
              }`}
            >
              <EmphasisGlyph mode={m.id} active={active} />
              <span>{m.label}</span>
              <span className="opacity-50">· {m.key}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Tiny inline glyph that visually previews each emphasis mode. */
function EmphasisGlyph({
  mode,
  active,
}: {
  readonly mode: EmphasisMode;
  readonly active: boolean;
}): ReactNode {
  const fg = active ? 'currentColor' : '#1b4d5a';
  const dim = active ? 'rgba(255,255,255,0.45)' : 'rgba(27,77,90,0.30)';
  // Three little bars representing tokens; the bold ones reflect the
  // mode's emphasis. shared = middle bars bold, differences = end bars
  // bold, plain = all even.
  return (
    <svg width={14} height={10} viewBox="0 0 14 10" aria-hidden>
      {mode === 'shared' ? (
        <>
          <rect x={0} y={3} width={2} height={4} rx={1} fill={dim} />
          <rect x={3} y={2} width={2} height={6} rx={1} fill={fg} />
          <rect x={6} y={2} width={2} height={6} rx={1} fill={fg} />
          <rect x={9} y={2} width={2} height={6} rx={1} fill={fg} />
          <rect x={12} y={3} width={2} height={4} rx={1} fill={dim} />
        </>
      ) : mode === 'differences' ? (
        <>
          <rect x={0} y={2} width={2} height={6} rx={1} fill={fg} />
          <rect x={3} y={3} width={2} height={4} rx={1} fill={dim} />
          <rect x={6} y={3} width={2} height={4} rx={1} fill={dim} />
          <rect x={9} y={3} width={2} height={4} rx={1} fill={dim} />
          <rect x={12} y={2} width={2} height={6} rx={1} fill={fg} />
        </>
      ) : (
        <>
          <rect x={0} y={3} width={2} height={4} rx={1} fill={fg} />
          <rect x={3} y={3} width={2} height={4} rx={1} fill={fg} />
          <rect x={6} y={3} width={2} height={4} rx={1} fill={fg} />
          <rect x={9} y={3} width={2} height={4} rx={1} fill={fg} />
          <rect x={12} y={3} width={2} height={4} rx={1} fill={fg} />
        </>
      )}
    </svg>
  );
}

function ModeLegend({ mode }: { readonly mode: EmphasisDef }): ReactNode {
  return (
    <div
      className="paper-card flex flex-wrap items-baseline gap-3 px-4 py-3"
      style={{ borderLeft: '3px solid var(--color-leaf-500, #1b4d5a)' }}
    >
      <p className="smallcaps text-leaf shrink-0 text-[10px] tracking-widest">{mode.label}</p>
      <p className="text-ink-muted/85 flex-1 text-xs leading-relaxed">{mode.description}</p>
    </div>
  );
}

interface ColProps {
  readonly verseKey: string;
  readonly tokens: readonly AlignedToken[];
  readonly covered: boolean;
  readonly accent: 'leaf' | 'gold';
  readonly emphasis: EmphasisMode;
}

function VerseColumn({ verseKey, tokens, covered, accent, emphasis }: ColProps): ReactNode {
  const accentClass = accent === 'leaf' ? 'text-leaf' : 'text-[var(--color-gold-500,#b6862c)]';
  return (
    <div className="paper-card flex min-h-[12rem] flex-col gap-3 px-5 py-5">
      <div className="flex items-baseline justify-between">
        <a
          href={`/study/${verseKey.split(':')[0] ?? '1'}/${verseKey.split(':')[1] ?? '1'}`}
          className={`smallcaps text-[11px] tracking-widest hover:underline ${accentClass}`}
        >
          {verseKey}
        </a>
        <span className="text-ink-muted/70 font-mono text-[10px] tabular-nums">
          {tokens.length.toString()} words
        </span>
      </div>
      {covered ? (
        <div className="text-ink-muted/60 flex flex-1 items-center justify-center text-center text-sm italic">
          Covered for drill — recall this verse, then tap Reveal.
        </div>
      ) : (
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic flex flex-wrap gap-x-2 gap-y-3 text-right leading-loose"
          style={{
            unicodeBidi: 'plaintext',
            fontFamily: '"UthmanicHafs"',
            fontSize: 'clamp(1.4rem, 1rem + 1.2vw, 2rem)',
            lineHeight: 1.95,
          }}
        >
          {tokens.map((t, idx) => (
            <TokenPill
              key={`${idx.toString()}-${t.token}`}
              token={t.token}
              mark={t.mark}
              emphasis={emphasis}
              accent={accent}
            />
          ))}
        </p>
      )}
    </div>
  );
}

/**
 * One token rendered with the active emphasis treatment. The class
 * choice is the sole place where shared/changed mark becomes visual
 * weight, so flipping the emphasis mode is a single-place decision.
 *
 * Visual language (in addition to opacity + weight):
 *   - Emphasised words get a soft tinted background (leaf for shared,
 *     gold for differences) so colour-blind / reduced-contrast users
 *     get a second cue beyond bold/dim.
 *   - Underline-offset accent for emphasised words so the cue survives
 *     when a user has prefers-reduced-motion (no opacity transition).
 *   - A 200ms cubic-bezier transition on font-weight + opacity +
 *     background so flipping emphasis modes is visibly animated.
 */
function TokenPill({
  token,
  mark,
  emphasis,
  accent,
}: {
  readonly token: string;
  readonly mark: DiffMark;
  readonly emphasis: EmphasisMode;
  readonly accent: 'leaf' | 'gold';
}): ReactNode {
  const isEmphasised =
    emphasis === 'plain' ? false : emphasis === 'shared' ? mark === 'shared' : mark === 'changed';
  // Pick the background tint based on what's being emphasised, not on
  // the column accent — so "shared" is always leaf-tinted and
  // "differences" is always gold-tinted, regardless of which column.
  const tint =
    emphasis === 'shared'
      ? 'color-mix(in oklch, var(--color-leaf-500, #1b4d5a) 10%, transparent)'
      : emphasis === 'differences'
        ? 'color-mix(in oklch, var(--color-gold-500, #b6862c) 12%, transparent)'
        : 'transparent';
  const underline =
    emphasis === 'shared'
      ? 'var(--color-leaf-500, #1b4d5a)'
      : emphasis === 'differences'
        ? 'var(--color-gold-500, #b6862c)'
        : 'transparent';
  void accent; // currently unused — accent stays on the verse-key chip
  return (
    <span
      style={{
        transition:
          'opacity 200ms cubic-bezier(0.2, 0.8, 0.2, 1), font-weight 200ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        opacity: emphasis === 'plain' ? 1 : isEmphasised ? 1 : 0.45,
        fontWeight: isEmphasised ? 700 : 500,
        background: isEmphasised ? tint : 'transparent',
        borderRadius: '0.4rem',
        padding: isEmphasised ? '0.05em 0.3em' : '0',
        // Inline underline-offset gives a non-opacity cue for
        // accessibility — the prefers-reduced-motion media query
        // disables the transition above but the underline remains.
        textDecoration: isEmphasised ? 'underline' : 'none',
        textDecorationColor: underline,
        textDecorationThickness: '0.06em',
        textUnderlineOffset: '0.25em',
        color: isEmphasised ? 'var(--color-ink-strong, #0e0e0e)' : 'var(--color-ink, #1a1a1a)',
      }}
    >
      {renderWithSilentMarks(token, `tk-${mark}`)}
    </span>
  );
}
