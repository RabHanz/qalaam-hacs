/**
 * /share-card/[verseKey] — print-ready ayah card.
 *
 * This page is NOT user-facing. It's a clean, chrome-free render of an
 * ayah designed to be screenshotted by Puppeteer for OG card generation
 * (/og/ayah/[verseKey] does the actual screenshot).
 *
 * Why screenshot vs Satori: the existing AyahCard / Read surface uses
 * real browser font shaping (joining Arabic letters), real CSS for
 * tajweed coloring (.tajweed-* classes), real <span dangerouslySetInnerHTML>
 * for tafsir HTML, etc. Replicating all of that in Satori is fragile.
 * Puppeteer renders the ACTUAL components — full fidelity, no
 * reinvention.
 *
 * Query params (forwarded by /og/ayah handler):
 *   - format=landscape|square|story
 *   - variant=minimal|translation|wbw|advanced
 *   - layout=madani_15|kfgqpc_v1|tajweed|…
 *   - transliteration=1, grammar=1, tafsir=1
 */
import { notFound } from 'next/navigation';

import { ShareCardSurface } from '../../../components/ShareCardSurface.js';
import { sanitizeMorphologyWords } from '../../../lib/morphology-display.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ verseKey: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface Verse {
  readonly verseKey: string;
  readonly textUthmani: string;
  readonly textIndopak: string | null;
  readonly textImlaei: string | null;
}
interface SurahInfo {
  readonly surah: number;
  readonly nameEnglish: string;
  readonly nameArabic: string;
  readonly nameTransliteration: string;
}
interface WbwWord {
  readonly verseKey: string;
  readonly wordIndex: number;
  readonly textArabic: string;
  readonly translation: string | null;
}
interface MorphologyToken {
  readonly tag: string;
  readonly form: string;
  readonly lemma: string | null;
  readonly root: string | null;
  readonly isStem: boolean;
}
interface MorphologyWord {
  readonly wordIndex: number;
  readonly tokens: readonly MorphologyToken[];
}
interface TajweedAnno {
  readonly start: number;
  readonly end: number;
  readonly rule: string;
}
interface TajweedResp {
  readonly verseKey: string;
  readonly annotations: readonly TajweedAnno[];
}

const API_BASE = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 604800 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function pickStr(v: string | string[] | undefined, def: string): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return def;
}
function pickFlag(v: string | string[] | undefined): boolean {
  return pickStr(v, '') === '1';
}

export default async function ShareCardPage({
  params,
  searchParams,
}: PageProps): Promise<ReactNode> {
  const { verseKey: rawVk } = await params;
  let verseKey = rawVk;
  try {
    verseKey = decodeURIComponent(rawVk);
  } catch {
    notFound();
  }
  if (!/^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/.test(verseKey)) notFound();

  const sp = await searchParams;
  const format = pickStr(sp.format, 'landscape') as 'landscape' | 'square' | 'story';
  const variant = pickStr(sp.variant, 'translation') as
    | 'minimal'
    | 'translation'
    | 'wbw'
    | 'advanced';
  const layoutSlug = pickStr(sp.layout, 'madani_15');
  // Forward the user's active translation/transliteration/tafsir if
  // provided (the share dialog passes whatever /read had selected).
  const translationSlug = pickStr(sp.translation, 'saheeh-international').replace(
    /[^a-z0-9-]/g,
    '',
  );
  const transliterationSlug = pickStr(sp.transliterationSlug, 'transliteration').replace(
    /[^a-z0-9-.]/g,
    '',
  );
  const tafsirSlug = pickStr(sp.tafsirSlug, 'jalalayn').replace(/[^a-z0-9-]/g, '');
  const showTransliteration = pickFlag(sp.transliteration);
  const showGrammar = pickFlag(sp.grammar) || variant === 'advanced';
  const showTafsir = pickFlag(sp.tafsir) || variant === 'advanced';
  const isTajweedLayout = layoutSlug === 'tajweed' || layoutSlug === 'kfgqpc_v4';
  // Fit-to-content (collapses min-height) + scale multiplier (1, 1.25, 1.5)
  const fit = pickFlag(sp.fit);
  const scaleRaw = Number.parseFloat(pickStr(sp.scale, '1'));
  const scale = Number.isFinite(scaleRaw) ? Math.max(0.8, Math.min(2, scaleRaw)) : 1;

  const surah = Number.parseInt(verseKey.split(':')[0] ?? '1', 10);

  const [verse, meta] = await Promise.all([
    fetchJson<Verse>(`${API_BASE}/v1/verses/by_key/${encodeURIComponent(verseKey)}`),
    fetchJson<{ data?: SurahInfo[] }>(`${API_BASE}/v1/metadata/surahs`).then(
      (b) => b?.data?.find((s) => s.surah === surah) ?? null,
    ),
  ]);

  if (!verse) notFound();

  const needsTranslation = variant !== 'minimal' && variant !== 'wbw';
  const needsWbw = variant === 'wbw';
  const needsTafsir = showTafsir;
  const needsGrammar = showGrammar;
  const needsTransliteration = showTransliteration;

  const [translation, transliteration, wbw, tafsir, morphology, tajweed] = await Promise.all([
    needsTranslation
      ? fetchJson<{ text?: string }>(
          `${API_BASE}/v1/translations/${encodeURIComponent(translationSlug)}/by_verse/${encodeURIComponent(verseKey)}`,
        ).then((b) => b?.text ?? null)
      : Promise.resolve(null),
    needsTransliteration
      ? fetchJson<{ text?: string }>(
          `${API_BASE}/v1/transliterations/${encodeURIComponent(transliterationSlug)}/by_verse/${encodeURIComponent(verseKey)}`,
        ).then((b) => b?.text ?? null)
      : Promise.resolve(null),
    needsWbw
      ? fetchJson<{ data: { words: readonly WbwWord[] } }>(
          `${API_BASE}/v1/wbw/${encodeURIComponent(verseKey)}`,
        ).then((b) => b?.data.words ?? null)
      : Promise.resolve(null),
    needsTafsir
      ? fetchJson<{ text?: string; scholar?: string }>(
          `${API_BASE}/v1/tafsirs/${encodeURIComponent(tafsirSlug)}/by_verse/${encodeURIComponent(verseKey)}`,
        )
      : Promise.resolve(null),
    needsGrammar
      ? fetchJson<{ words: readonly MorphologyWord[] }>(
          `${API_BASE}/v1/morphology/${encodeURIComponent(verseKey)}`,
        )
      : Promise.resolve(null),
    isTajweedLayout
      ? fetchJson<TajweedResp>(`${API_BASE}/v1/tajweed/${encodeURIComponent(verseKey)}`)
      : Promise.resolve(null),
  ]);

  return (
    <ShareCardSurface
      verseKey={verseKey}
      surah={surah}
      surahMeta={meta}
      verse={verse}
      translation={translation}
      transliteration={transliteration}
      wbw={wbw}
      tafsir={tafsir?.text ?? null}
      tafsirScholar={tafsir?.scholar ?? null}
      tajweedAnnotations={tajweed?.annotations ?? null}
      morphology={morphology?.words ? sanitizeMorphologyWords(morphology.words) : null}
      format={format}
      variant={variant}
      layoutSlug={layoutSlug}
      showTransliteration={showTransliteration}
      showGrammar={showGrammar}
      showTafsir={showTafsir}
      fit={fit}
      scale={scale}
    />
  );
}
