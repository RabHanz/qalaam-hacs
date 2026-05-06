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

import { resolveApiBase } from '../lib/api-base.js';
import {
  POS_LABEL,
  featureChipLabel,
  lemmaDisplay,
  posClass,
  sanitizeMorphologyWords,
} from '../lib/morphology-display.js';

import type { ReactNode } from 'react';

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

// Display tables (POS_LABEL, posClass, FEATURE_LABEL, featureChipLabel,
// lemmaDisplay, displayableFeatures, tokenRoleLabel) live in
// `lib/morphology-display.ts` so /share-card and /study render the
// same i'rab faithfully — never duplicate or drift.

interface Props {
  readonly verseKey: string;
}

export function MorphologyPane({ verseKey }: Props): ReactNode {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null); // "wordIdx-tokenIdx"

  useEffect(() => {
    // Use a boxed flag so the closure sees the same reference TypeScript
    // knows can be mutated (raw `let` flips to "always falsy" in strict
    // narrowing because the assignment happens via the cleanup callback,
    // not the async body).
    const cancelled = { v: false };
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(
          `${resolveApiBase()}/v1/morphology/${encodeURIComponent(verseKey)}`,
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status.toString()}`);
        }
        const body = (await res.json()) as ApiResponse;
        // Defence in depth: even though the backend strips the
        // Buckwalter "@" silent-letter marker from form_arabic, an
        // HTTP-cached response from before the backend fix may still
        // contain `@`. Sanitise here so the rendered DOM is always
        // clean Arabic.
        const sanitised: ApiResponse = {
          ...body,
          words: sanitizeMorphologyWords(body.words) as ApiResponse['words'],
        };
        if (!cancelled.v) setData(sanitised);
      } catch (err) {
        if (!cancelled.v) {
          setError(err instanceof Error ? err.message : 'Could not load morphology right now.');
        }
      } finally {
        if (!cancelled.v) setLoading(false);
      }
    })();
    return () => {
      cancelled.v = true;
    };
  }, [verseKey]);

  if (loading) {
    return <div className="text-ink-muted text-sm italic">Loading morphology…</div>;
  }
  if (error) {
    return <p className="text-ink-muted text-sm italic">Morphology unavailable ({error}).</p>;
  }
  if (!data || data.words.length === 0) {
    return <p className="text-ink-muted text-sm italic">No morphology data for {verseKey}.</p>;
  }

  return (
    <div className="space-y-4">
      <ol
        dir="rtl"
        lang="ar"
        className="m-0 flex list-none flex-wrap justify-center gap-3 p-0"
        style={{ unicodeBidi: 'plaintext' }}
      >
        {data.words.map((w) => (
          <li
            key={w.wordIndex}
            className="paper-card hover-rise flex min-w-[5.5rem] flex-col items-center gap-1.5 px-3 py-3 sm:px-4 sm:py-4"
          >
            {/* Combined Arabic word — concatenated tokens (prefix +
                stem + suffix) so the user sees the natural mushaf word. */}
            <p
              dir="rtl"
              lang="ar"
              className="text-ink-strong text-center leading-tight"
              style={{
                fontFamily: '"UthmanicHafs"',
                fontSize: 'clamp(1.6rem, 1.2rem + 1.4vw, 2.3rem)',
                fontWeight: 600,
                unicodeBidi: 'plaintext',
              }}
            >
              {w.tokens.map((t) => t.form).join('')}
            </p>

            {/* Per-token chips */}
            <div className="mt-1.5 flex flex-wrap justify-center gap-1">
              {w.tokens.map((t) => {
                const key = `${w.wordIndex.toString()}-${t.tokenIndex.toString()}`;
                const isOpen = expanded === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setExpanded(isOpen ? null : key);
                    }}
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
                  .filter(
                    (t) => `${w.wordIndex.toString()}-${t.tokenIndex.toString()}` === expanded,
                  )
                  .map((t) => (
                    <div
                      key={`${t.tokenIndex.toString()}-detail`}
                      dir="ltr"
                      className="text-ink-muted border-hairline mt-2 w-full border-t pt-2 text-left text-[11px] leading-relaxed"
                    >
                      <p className="smallcaps text-leaf mb-1 text-[10px] tracking-widest">
                        {POS_LABEL[t.tag] ?? t.tag}
                        {t.isPrefix
                          ? ' · prefix'
                          : t.isStem
                            ? ' · stem'
                            : t.isSuffix
                              ? ' · suffix'
                              : ''}
                      </p>
                      {t.lemma ? (
                        <p>
                          <span className="text-ink/60">lemma · </span>
                          <span dir="rtl" className="font-arabic text-ink">
                            {lemmaDisplay(t.lemma)}
                          </span>
                        </p>
                      ) : null}
                      {t.root ? (
                        <p>
                          <span className="text-ink/60">root · </span>
                          <a
                            href={`/concordance/root/${encodeURIComponent(t.root)}`}
                            className="text-leaf font-mono tabular-nums hover:underline"
                            title={`Concordance: every word from root ${t.root}`}
                          >
                            {t.root}
                          </a>
                        </p>
                      ) : null}
                      {/* Selected features (gender / number / case / mood / voice). */}
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {Object.entries(t.features)
                          .filter(
                            ([k]) =>
                              !['STEM', 'PREFIX', 'SUFFIX', 'POS', 'LEM', 'ROOT'].includes(k),
                          )
                          .slice(0, 6)
                          .map(([k, v]) => (
                            <span
                              key={k}
                              className="border-hairline text-ink-muted/90 inline-block rounded border px-1.5 py-0.5 text-[10px] tracking-wide"
                              title={featureChipLabel(k, v)}
                            >
                              {featureChipLabel(k, v)}
                            </span>
                          ))}
                      </p>
                    </div>
                  ))
              : null}
          </li>
        ))}
      </ol>

      <p className="text-ink-muted mt-2 text-center text-[10px] italic">
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
