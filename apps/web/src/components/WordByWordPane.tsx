/**
 * Per-word translation pane for the deep-study reader.
 *
 * Reads /v1/wbw/:verseKey?lang=en (default) and renders each word with its
 * Arabic + English gloss. Optional `?include=morphology` is gated server-side
 * — when present, the pane shows root + lemma + POS as a third line per word.
 *
 * Per ADR-0020 + Phase 17 §17.5: this is the bundle-safe surface (translation
 * is permissive-with-credit). Morphology is opt-in through a small toggle the
 * caller controls; the toggle isn't shown unless the runtime context permits
 * surfacing copyleft-derived data.
 */
import type { ReactNode } from 'react';

interface Word {
  verseKey: string;
  wordIndex: number;
  textArabic: string;
  translation: string;
  languageCode: string;
}

interface Morphology {
  verseKey: string;
  wordIndex: number;
  root: string | null;
  lemma: string | null;
  stem: string | null;
  pos: string | null;
  irab: string | null;
}

interface WbwPayload {
  data: {
    words: Word[];
    morphology: Morphology[] | null;
  };
  attribution: {
    translation: string;
    translation_license: string;
    morphology: string | null;
    morphology_license: string | null;
  };
}

async function fetchWbw(
  baseUrl: string,
  verseKey: string,
  options: { includeMorphology: boolean },
): Promise<WbwPayload | null> {
  try {
    const url = new URL(`${baseUrl}/v1/wbw/${encodeURIComponent(verseKey)}`);
    url.searchParams.set('lang', 'en');
    if (options.includeMorphology) url.searchParams.set('include', 'morphology');
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!res.ok) return null;
    return (await res.json()) as WbwPayload;
  } catch {
    return null;
  }
}

export interface WordByWordPaneProps {
  readonly verseKey: string;
  readonly baseUrl?: string;
  /**
   * Include morphology (gpl-derivative). Default false. The caller must
   * affirm the runtime permits surfacing copyleft data.
   */
  readonly includeMorphology?: boolean;
}

export async function WordByWordPane({
  verseKey,
  baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4100',
  includeMorphology = false,
}: WordByWordPaneProps): Promise<ReactNode> {
  const payload = await fetchWbw(baseUrl, verseKey, { includeMorphology });
  if (!payload || payload.data.words.length === 0) {
    return null;
  }

  const morphologyByIndex = new Map<number, Morphology>();
  if (payload.data.morphology) {
    for (const m of payload.data.morphology) {
      morphologyByIndex.set(m.wordIndex, m);
    }
  }

  return (
    <section
      aria-label={`Word-by-word for ${verseKey}`}
      style={{
        background: 'var(--color-surface-raised, #fff)',
        borderRadius: '1rem',
        padding: '1rem 1.25rem',
        boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Word by word</h3>
        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{payload.attribution.translation}</span>
      </header>
      <div
        dir="rtl"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem 1rem',
          alignItems: 'flex-start',
        }}
      >
        {payload.data.words.map((w) => {
          const morph = morphologyByIndex.get(w.wordIndex);
          return (
            <div
              key={`${w.verseKey}-${w.wordIndex.toString()}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '5.5rem',
                maxWidth: '11rem',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-arabic, serif)',
                  fontSize: '1.5rem',
                  lineHeight: 1.1,
                }}
              >
                {w.textArabic}
              </span>
              <span
                dir="ltr"
                style={{
                  marginTop: '0.25rem',
                  fontSize: '0.8125rem',
                  textAlign: 'center',
                  opacity: 0.85,
                }}
              >
                {w.translation}
              </span>
              {morph ? (
                <span
                  dir="ltr"
                  style={{
                    marginTop: '0.2rem',
                    fontSize: '0.75rem',
                    opacity: 0.6,
                    textAlign: 'center',
                  }}
                >
                  {[morph.root, morph.pos].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {includeMorphology && payload.attribution.morphology ? (
        <footer style={{ marginTop: '0.75rem', fontSize: '0.7rem', opacity: 0.55 }}>
          Morphology: {payload.attribution.morphology}
        </footer>
      ) : null}
    </section>
  );
}
