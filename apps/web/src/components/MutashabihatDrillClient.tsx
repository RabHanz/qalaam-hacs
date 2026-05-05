'use client';

/**
 * MutashabihatDrillClient — interactive side-by-side drill UI.
 *
 * - Tokenizes each verse on whitespace, normalizes (strips diacritics +
 *   maps alif-presentation forms to bare alif), and word-aligns by
 *   greedy LCS so identical words stay dim and diffs pop.
 * - "Cover partner" toggle hides the right column for memory drill.
 * - Chip row at the bottom switches partner without page nav (URL
 *   updates via replaceState so the link is shareable).
 */
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

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

/**
 * Strip Arabic diacritics + presentation marks so word-level diff can
 * match across mushaf typographic variants (e.g., يَـٰبَنِى vs يَا بَنِى
 * resolves to the same surface form).
 */
function normalize(s: string): string {
  return s
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // tashkeel + presentation
    .replace(/[ٱآأإ]/g, 'ا') // alif variants → bare alif
    .replace(/ـ/g, '') // tatweel
    .replace(/\u200b|\u200c|\u200d|\u200e|\u200f/g, '') // ZWSP/ZWNJ/ZWJ/LRM/RLM
    .normalize('NFC')
    .trim();
}

function tokenize(verse: string): readonly string[] {
  // Split on whitespace AND remove the trailing verse-end marker
  // (٠–٩ + END_OF_AYAH). The verse-end marker is part of the SQL
  // textUthmani — strip it for diffing but preserve it for display.
  return verse
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .filter((t) => !/^[٠-٩۰-۹]+$/.test(t)); // ayah numerals
}

/**
 * Greedy LCS-based alignment. Returns parallel arrays where each item
 * is { token, kind } — kind ∈ "shared" | "added" | "removed". Used to
 * mark diff highlights independently for the left and right verse.
 */
type DiffMark = 'shared' | 'changed';

interface AlignedToken {
  readonly token: string;
  readonly mark: DiffMark;
}

function diffTokens(
  a: readonly string[],
  b: readonly string[],
): { left: readonly AlignedToken[]; right: readonly AlignedToken[] } {
  // Build LCS table on normalized tokens
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
  // Backtrack to mark which tokens are shared vs changed.
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

export function MutashabihatDrillClient({ primary, partner, partnerCandidates }: Props): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const [coverPartner, setCoverPartner] = useState(false);

  const { leftTokens, rightTokens } = useMemo(() => {
    const a = tokenize(primary.textUthmani);
    const b = tokenize(partner.textUthmani);
    const aligned = diffTokens(a, b);
    return { leftTokens: aligned.left, rightTokens: aligned.right };
  }, [primary.textUthmani, partner.textUthmani]);

  function switchPartner(vk: string): void {
    if (vk === partner.verseKey) return;
    router.push(`${pathname}?partner=${encodeURIComponent(vk)}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      {/* Drill controls */}
      <div className="border-hairline flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <p className="smallcaps text-ink-muted text-[11px] tracking-widest">
          {leftTokens.length.toString()} ↔ {rightTokens.length.toString()} words
        </p>
        <button
          type="button"
          onClick={() => {
            setCoverPartner((c) => !c);
          }}
          className={`smallcaps rounded-full px-4 py-1.5 text-[11px] tracking-widest transition-colors ${
            coverPartner
              ? 'bg-leaf text-paper'
              : 'border-hairline text-ink-muted hover:text-leaf border'
          }`}
        >
          {coverPartner ? 'Reveal partner' : 'Cover partner'}
        </button>
      </div>

      {/* Side-by-side diff. Mobile stacks vertical, desktop two-column. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <VerseColumn
          verseKey={primary.verseKey}
          tokens={leftTokens}
          covered={false}
          accent="leaf"
        />
        <VerseColumn
          verseKey={partner.verseKey}
          tokens={rightTokens}
          covered={coverPartner}
          accent="gold"
        />
      </div>

      {/* Other partners */}
      {partnerCandidates.length > 1 ? (
        <div className="border-hairline mt-6 border-t pt-4">
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
                      : 'border-hairline text-ink-muted hover:text-leaf border'
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

      {/* Legend */}
      <p className="text-ink-muted/70 mt-6 text-center text-[11px] italic">
        <span className="text-ink/90">Bold</span> words are unique to this verse; dim words are
        shared. Source: QUL mutashabihat-v2 corpus · permissive-with-credit
      </p>
    </div>
  );
}

interface ColProps {
  readonly verseKey: string;
  readonly tokens: readonly AlignedToken[];
  readonly covered: boolean;
  readonly accent: 'leaf' | 'gold';
}

function VerseColumn({ verseKey, tokens, covered, accent }: ColProps): ReactNode {
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
          className="font-arabic flex flex-wrap-reverse gap-x-2 gap-y-3 text-right leading-loose"
          style={{
            unicodeBidi: 'plaintext',
            fontFamily: '"UthmanicHafs", "Amiri Quran", "Noto Naskh Arabic", serif',
            fontSize: 'clamp(1.4rem, 1rem + 1.2vw, 2rem)',
            lineHeight: 1.85,
          }}
        >
          {tokens.map((t, idx) => (
            <span
              key={`${idx.toString()}-${t.token}`}
              className={
                t.mark === 'shared'
                  ? 'text-ink-muted/55'
                  : 'text-ink-strong rounded-md bg-[color-mix(in_oklch,var(--color-leaf-500,#1b4d5a)_8%,transparent)] px-1 font-semibold'
              }
            >
              {t.token}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
