'use client';

/**
 * MorphologyPane — word-by-word grammatical analysis for /study.
 *
 * Source: Quranic Arabic Corpus v0.4 (Kais Dukes, 2011) — 128k+
 * tokens with POS / lemma / root / Buckwalter form. Served by
 * /v1/morphology/:verseKey.
 *
 * UX principle (per Rabee Operating System §11.3 design quality):
 *   - Mushaf-grade Arabic typography for the form (UthmanicHafs, RTL).
 *   - Buckwalter visible only as a tap-to-reveal "scholar mode" detail.
 *   - POS pills with semantic color (verbs warm, nouns cool, particles
 *     neutral) so the eye reads grammatical structure at a glance.
 *   - Root chip → /study?root=:root concordance jump (339+ occurrences
 *     for rHm, ~2k for klm…).
 *
 * Reduced-motion-aware. Dark-mode AA contrast.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

interface ApiToken {
  readonly tokenIndex: number;
  readonly tag: string;
  readonly form: string;
  readonly formBuckwalter: string;
  readonly lemma: string | null;
  readonly root: string | null;
  readonly isPrefix: boolean;
  readonly isStem: boolean;
  readonly isSuffix: boolean;
  readonly features: Record<string, unknown>;
}

interface ApiWord {
  readonly wordIndex: number;
  readonly tokens: readonly ApiToken[];
}

interface ApiResponse {
  readonly verseKey: string;
  readonly words: readonly ApiWord[];
  readonly source: string;
  readonly sourceUrl: string;
  readonly license: string;
}

/**
 * POS tag → human-readable English label. Comprehensive coverage of
 * Kais Dukes' 45-tag set.
 */
const POS_LABEL: Record<string, string> = {
  // Nominals
  N: 'Noun',
  PN: 'Proper noun',
  ADJ: 'Adjective',
  // Verbal
  V: 'Verb',
  // Function words / particles
  P: 'Preposition',
  CONJ: 'Conjunction',
  SUB: 'Subordinator',
  REM: 'Resumption particle',
  CIRC: 'Circumstantial',
  RES: 'Restriction',
  EXP: 'Explanation',
  COND: 'Conditional',
  // Pronouns
  PRON: 'Pronoun',
  REL: 'Relative pronoun',
  DEM: 'Demonstrative',
  // Determiners + negation
  DET: 'Determiner',
  NEG: 'Negation',
  EXH: 'Exhortation',
  // Vocative + emphatic
  VOC: 'Vocative',
  EMPH: 'Emphatic',
  // Special
  INL: 'Quranic initials',
  ACC: 'Accusative particle',
  AVR: 'Aversion particle',
  CAUS: 'Causal particle',
  AMD: 'Amendment',
  COM: 'Comitative',
  EQ: 'Equality',
  IMPV: 'Imperative',
  INC: 'Inceptive',
  INT: 'Interrogative',
  PRP: 'Purpose',
  PRO: 'Prohibition',
  RET: 'Retraction',
  SUP: 'Supplemental',
  T: 'Time adverb',
  LOC: 'Location adverb',
  FUT: 'Future particle',
  ANS: 'Answer particle',
  CERT: 'Certainty',
  PREV: 'Preventive',
  INTG: 'Interrogative',
};

/**
 * POS tag → semantic color group. Matches Tarteel/Quran.com convention
 * loosely: verbs warm (red/orange), nouns cool (teal/blue), function
 * words muted (gray).
 */
function posClass(tag: string): string {
  if (tag === 'V' || tag === 'IMPV') return 'pos-verb';
  if (tag === 'N' || tag === 'PN') return 'pos-noun';
  if (tag === 'ADJ') return 'pos-adj';
  if (tag === 'PRON' || tag === 'REL' || tag === 'DEM') return 'pos-pronoun';
  if (tag === 'P' || tag === 'CONJ' || tag === 'SUB' || tag === 'REM' || tag === 'CIRC') return 'pos-particle';
  if (tag === 'DET') return 'pos-det';
  if (tag === 'NEG' || tag === 'PRO') return 'pos-neg';
  return 'pos-other';
}

/**
 * Decode Buckwalter lemma marker — strip the `{` (alif-wasl) prefix
 * for display so "{ll~ah" reads as "Allah".
 */
function lemmaDisplay(lemma: string): string {
  return lemma.replace(/^\{/, '').replace(/[~`]/g, '');
}

interface Props {
  readonly verseKey: string;
}

export function MorphologyPane({ verseKey }: Props): ReactNode {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null); // "wordIdx-tokenIdx"

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`${resolveApiBase()}/v1/morphology/${encodeURIComponent(verseKey)}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status.toString()}`);
        }
        const body = (await res.json()) as ApiResponse;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'unknown');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verseKey]);

  if (loading) {
    return (
      <div className="text-sm text-ink-muted italic">Loading morphology…</div>
    );
  }
  if (error) {
    return <p className="text-sm text-ink-muted italic">Morphology unavailable ({error}).</p>;
  }
  if (!data || data.words.length === 0) {
    return <p className="text-sm text-ink-muted italic">No morphology data for {verseKey}.</p>;
  }

  return (
    <div className="space-y-4">
      <ol
        dir="rtl"
        lang="ar"
        className="flex flex-wrap-reverse gap-3 list-none p-0 m-0 justify-center"
        style={{ unicodeBidi: 'plaintext' }}
      >
        {data.words.map((w) => (
          <li
            key={w.wordIndex}
            className="paper-card hover-rise px-3 py-3 sm:px-4 sm:py-4 min-w-[5.5rem] flex flex-col items-center gap-1.5"
          >
            {/* Combined Arabic word — concatenated tokens (prefix +
                stem + suffix) so the user sees the natural mushaf word. */}
            <p
              dir="rtl"
              lang="ar"
              className="text-ink-strong leading-tight text-center"
              style={{
                fontFamily: '"UthmanicHafs", "Amiri Quran", "Noto Naskh Arabic", serif',
                fontSize: 'clamp(1.6rem, 1.2rem + 1.4vw, 2.3rem)',
                fontWeight: 600,
                unicodeBidi: 'plaintext',
              }}
            >
              {w.tokens.map((t) => t.form).join('')}
            </p>

            {/* Per-token chips */}
            <div className="flex flex-wrap-reverse justify-center gap-1 mt-1.5">
              {w.tokens.map((t) => {
                const key = `${w.wordIndex.toString()}-${t.tokenIndex.toString()}`;
                const isOpen = expanded === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : key)}
                    className={`pos-chip ${posClass(t.tag)} ${isOpen ? 'pos-chip-open' : ''}`}
                    title={POS_LABEL[t.tag] ?? t.tag}
                    aria-expanded={isOpen}
                  >
                    {POS_LABEL[t.tag] ?? t.tag}
                  </button>
                );
              })}
            </div>

            {/* Expanded detail panel for the active token */}
            {expanded?.startsWith(`${w.wordIndex.toString()}-`)
              ? w.tokens
                  .filter((t) => `${w.wordIndex.toString()}-${t.tokenIndex.toString()}` === expanded)
                  .map((t) => (
                    <div
                      key={`${t.tokenIndex.toString()}-detail`}
                      dir="ltr"
                      className="mt-2 w-full text-left text-[11px] text-ink-muted leading-relaxed border-t border-hairline pt-2"
                    >
                      <p className="smallcaps text-leaf text-[10px] tracking-widest mb-1">
                        {POS_LABEL[t.tag] ?? t.tag}
                        {t.isPrefix ? ' · prefix' : t.isStem ? ' · stem' : t.isSuffix ? ' · suffix' : ''}
                      </p>
                      {t.lemma ? (
                        <p>
                          <span className="text-ink/60">lemma · </span>
                          <span dir="rtl" className="font-arabic text-ink">{lemmaDisplay(t.lemma)}</span>
                        </p>
                      ) : null}
                      {t.root ? (
                        <p>
                          <span className="text-ink/60">root · </span>
                          <a
                            href={`/concordance/root/${encodeURIComponent(t.root)}`}
                            className="font-mono tabular-nums text-leaf hover:underline"
                            title={`Concordance: every word from root ${t.root}`}
                          >
                            {t.root}
                          </a>
                        </p>
                      ) : null}
                      {/* Selected features (gender / number / case / mood / voice). */}
                      <p className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(t.features)
                          .filter(([k]) => !['STEM', 'PREFIX', 'SUFFIX', 'POS', 'LEM', 'ROOT'].includes(k))
                          .slice(0, 6)
                          .map(([k, v]) => (
                            <span key={k} className="text-[10px] smallcaps text-ink-muted/80 tracking-widest">
                              {typeof v === 'boolean' ? k : `${k}:${String(v)}`}
                            </span>
                          ))}
                      </p>
                    </div>
                  ))
              : null}
          </li>
        ))}
      </ol>

      <p className="text-[10px] text-ink-muted text-center italic mt-2">
        {data.source} ·{' '}
        <a
          href={data.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-leaf"
        >
          corpus.quran.com
        </a>{' '}
        · {data.license}
      </p>
    </div>
  );
}
