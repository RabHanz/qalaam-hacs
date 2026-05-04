/**
 * Per-word translation pane for the deep-study reader.
 *
 * Reads /v1/wbw/:verseKey?lang=en (default). Renders each word as a
 * little stacked card: Arabic on top (display size, RTL), English gloss
 * below in IBM Plex Sans. Lays out as a flex-wrap RTL row so reading
 * order matches the verse.
 *
 * Per ADR-0020 + Phase 17 §17.5: bundle-safe surface (translation is
 * permissive-with-credit). Morphology opt-in, gated server-side.
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
  /** Include morphology (gpl-derivative). Default false. */
  readonly includeMorphology?: boolean;
}

export async function WordByWordPane({
  verseKey,
  baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4111',
  includeMorphology = false,
}: WordByWordPaneProps): Promise<ReactNode> {
  const payload = await fetchWbw(baseUrl, verseKey, { includeMorphology });
  if (!payload || payload.data.words.length === 0) {
    return (
      <p className="text-sm text-ink-muted italic">
        Word-by-word not available for this verse yet.
      </p>
    );
  }

  const morphologyByIndex = new Map<number, Morphology>();
  if (payload.data.morphology) {
    for (const m of payload.data.morphology) {
      morphologyByIndex.set(m.wordIndex, m);
    }
  }

  return (
    <div>
      <div
        dir="rtl"
        className="flex flex-wrap items-start gap-x-6 gap-y-5"
        style={{ unicodeBidi: 'plaintext' }}
      >
        {payload.data.words.map((w) => {
          const morph = morphologyByIndex.get(w.wordIndex);
          return (
            <div
              key={`${w.verseKey}-${w.wordIndex.toString()}`}
              className="group flex min-w-[5.5rem] max-w-[12rem] flex-col items-center gap-1"
            >
              <span
                className="font-arabic text-2xl text-ink-strong group-hover:text-leaf transition-colors"
                style={{ lineHeight: 1.1 }}
              >
                {w.textArabic}
              </span>
              <span dir="ltr" className="text-xs text-center text-ink-muted leading-snug">
                {w.translation}
              </span>
              {morph ? (
                <span dir="ltr" className="font-mono text-[10px] text-leaf/70 text-center smallcaps">
                  {[morph.root, morph.pos].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-[10px] smallcaps text-ink-muted">
        {payload.attribution.translation}
        {includeMorphology && payload.attribution.morphology
          ? ` · Morphology: ${payload.attribution.morphology}`
          : ''}
      </p>
    </div>
  );
}
