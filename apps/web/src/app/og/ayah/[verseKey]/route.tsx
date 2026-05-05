/**
 * /og/ayah/[verseKey] — Satori-rendered shareable ayah card.
 *
 * Format (?format=):     landscape (1200×*) | square (1080×1080) | story (1080×1920)
 * Content (?variant=):   minimal | translation | wbw | advanced
 * Layout  (?layout=):    madani_15 | kfgqpc_v1 | tajweed | indopak | …
 * Toggles:               &transliteration=1 &grammar=1 &tafsir=1
 *
 * Path lives outside `/api/*` so the next.config.mjs rewrite doesn't
 * proxy it to the backend.
 *
 * Arabic shaping: arabic-persian-reshaper converts logical-order
 * Arabic to Presentation Forms-A/B; flex-wrap-reverse + intra-word
 * codepoint reverse gives correct RTL reading order top-down despite
 * Satori having no bidi engine.
 *
 * Tajweed: when layout indicates tajweed, render annotated char ranges
 * with inline `color: …` (Satori has no class lookup, so .tajweed-*
 * CSS doesn't reach the renderer — colors are inlined per rule).
 *
 * Per ADR-0017.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ArabicShaper } from 'arabic-persian-reshaper';
import { ImageResponse } from 'next/og';

import type { NextRequest } from 'next/server';

interface ReshaperApi {
  readonly convertArabic: (s: string) => string;
}
const reshaper = ArabicShaper as ReshaperApi;

export const runtime = 'nodejs';
export const revalidate = 604800; // 7 days

let cachedFonts: { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[] | undefined;

async function getFonts(): Promise<
  { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[]
> {
  if (cachedFonts) return cachedFonts;
  const fontDir = path.join(process.cwd(), 'public', 'fonts', 'og');
  const [arabic, inter] = await Promise.all([
    readFile(path.join(fontDir, 'noto-naskh-no-gsub.ttf')),
    readFile(path.join(fontDir, 'inter-regular.woff')),
  ]);
  cachedFonts = [
    { name: 'NotoArabic', data: arabic, weight: 400, style: 'normal' },
    { name: 'NotoArabic', data: arabic, weight: 700, style: 'normal' },
    { name: 'Inter', data: inter, weight: 400, style: 'normal' },
    { name: 'Inter', data: inter, weight: 700, style: 'normal' },
  ];
  return cachedFonts;
}

interface Verse {
  readonly verseKey: string;
  readonly textUthmani: string;
  readonly textIndopak: string | null;
  readonly textImlaei: string | null;
  readonly textQpcHafs: string | null;
}
interface SurahInfo {
  readonly surah: number;
  readonly nameEnglish: string;
  readonly nameArabic: string;
  readonly nameTransliteration: string;
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
interface MorphologyResp {
  readonly verseKey: string;
  readonly words: readonly MorphologyWord[];
}
interface WbwWord {
  readonly verseKey: string;
  readonly wordIndex: number;
  readonly textArabic: string;
  readonly translation: string | null;
}
interface WbwResp {
  readonly data: { readonly words: readonly WbwWord[] };
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
interface TafsirResp {
  readonly text?: string;
  readonly scholar?: string;
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

const fetchVerse = (vk: string): Promise<Verse | null> =>
  fetchJson<Verse>(`${API_BASE}/v1/verses/by_key/${encodeURIComponent(vk)}`);

const fetchTajweed = (vk: string): Promise<TajweedResp | null> =>
  fetchJson<TajweedResp>(`${API_BASE}/v1/tajweed/${encodeURIComponent(vk)}`);

const fetchTranslation = async (vk: string): Promise<string | null> => {
  const body = await fetchJson<{ text?: string }>(
    `${API_BASE}/v1/translations/saheeh-international/by_verse/${encodeURIComponent(vk)}`,
  );
  return body?.text ?? null;
};

const fetchTafsirSnippet = async (vk: string): Promise<string | null> => {
  const body = await fetchJson<TafsirResp>(
    `${API_BASE}/v1/tafsirs/jalalayn/by_verse/${encodeURIComponent(vk)}`,
  );
  if (!body?.text) return null;
  // Strip HTML tags + collapse whitespace, then truncate
  const stripped = body.text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > 280 ? stripped.slice(0, 277).trimEnd() + '…' : stripped;
};

const fetchMorphology = (vk: string): Promise<MorphologyResp | null> =>
  fetchJson<MorphologyResp>(`${API_BASE}/v1/morphology/${encodeURIComponent(vk)}`);

const fetchWbw = (vk: string): Promise<WbwResp | null> =>
  fetchJson<WbwResp>(`${API_BASE}/v1/wbw/${encodeURIComponent(vk)}`);

async function fetchSurahMeta(surah: number): Promise<SurahInfo | null> {
  const body = await fetchJson<{ data?: SurahInfo[] }>(`${API_BASE}/v1/metadata/surahs`);
  return body?.data?.find((s) => s.surah === surah) ?? null;
}

type Format = 'landscape' | 'square' | 'story';
type Variant = 'minimal' | 'translation' | 'wbw' | 'advanced';

function asFormat(s: string | null | undefined): Format {
  if (s === 'square' || s === 'story') return s;
  // Backwards compat with the older `?variant=story` URL form
  return 'landscape';
}
function asVariant(s: string | null | undefined): Variant {
  if (s === 'wbw' || s === 'advanced' || s === 'minimal') return s;
  // Default + back-compat: any 'full' / 'translation' / unset → translation
  return 'translation';
}

/**
 * Pick the verse text source per layout.
 * - kfgqpc_v1 / indopak* → textIndopak
 * - kfgqpc_v4 / tajweed   → textImlaei (matches the tajweed annotation
 *   character offsets, which are aligned to the imlaei script)
 * - everything else        → textUthmani
 */
function arabicTextFor(verse: Verse, layoutSlug: string): string {
  if (layoutSlug === 'kfgqpc_v1' || layoutSlug === 'indopak' || layoutSlug.includes('indopak')) {
    return verse.textIndopak ?? verse.textUthmani;
  }
  if (layoutSlug === 'kfgqpc_v4' || layoutSlug === 'tajweed') {
    return verse.textImlaei ?? verse.textUthmani;
  }
  return verse.textUthmani;
}

/**
 * Tajweed rule → display color for inline rendering. Mirrors the
 * .tajweed-* palette in apps/web/src/styles/globals.css but inlined
 * because Satori can't resolve external CSS classes.
 */
const TAJWEED_COLOR: Record<string, string> = {
  ghunnah: '#2d8c4e',
  idghaam_ghunnah: '#2d8c4e',
  idghaam_no_ghunnah: '#3478b6',
  idghaam_shafawi: '#3478b6',
  idghaam_mutajanisayn: '#3478b6',
  idghaam_mutaqaribayn: '#3478b6',
  ikhfa: '#0f9aa6',
  ikhfa_shafawi: '#0f9aa6',
  iqlab: '#a64db2',
  qalqalah: '#c0392b',
  madd_2: '#d49321',
  madd_246: '#d49321',
  madd_munfasil: '#d49321',
  madd_6: '#c0392b',
  madd_muttasil: '#c0392b',
  hamzat_wasl: '#909090',
  silent: '#909090',
  lam_shamsiyyah: '#a8a8a8',
};

interface AppliedSeg {
  readonly text: string;
  readonly rule?: string;
}
function applyTajweed(text: string, anno: readonly TajweedAnno[]): readonly AppliedSeg[] {
  if (anno.length === 0) return [{ text }];
  const sorted = [...anno].sort((a, b) => a.start - b.start);
  const out: AppliedSeg[] = [];
  let cursor = 0;
  for (const a of sorted) {
    if (a.start < cursor) continue;
    if (a.start > cursor) out.push({ text: text.slice(cursor, a.start) });
    out.push({ text: text.slice(a.start, a.end), rule: a.rule });
    cursor = a.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

/** Pre-shape an Arabic word for Satori (joining + intra-word reverse). */
function shapeWord(text: string): string {
  return Array.from(reshaper.convertArabic(text)).reverse().join('');
}

/**
 * Pre-shape a verse's words for the wrap-reverse flex container — each
 * returned string is one word in pre-shaped, reverse-codepoint form.
 * The array itself is also reversed so flex (LTR layout) places words
 * in the right visual order for the right-to-left reader.
 */
function shapeVerse(text: string): readonly string[] {
  const stripped = text.replace(/[٠-٩۰-۹]+$/u, '').trim();
  return stripped
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => shapeWord(w))
    .reverse();
}

// ---- Sizing -----------------------------------------------------------

function arabicFontSizeFor(format: Format, variant: Variant, chars: number): number {
  if (format === 'story') {
    if (chars > 600) return 38;
    if (chars > 400) return 46;
    if (chars > 200) return 56;
    return 68;
  }
  if (format === 'square') {
    if (chars > 600) return 28;
    if (chars > 400) return 34;
    if (chars > 200) return 42;
    return 54;
  }
  // landscape
  if (variant === 'wbw' || variant === 'advanced') {
    if (chars > 600) return 28;
    if (chars > 300) return 36;
    return 44;
  }
  if (chars > 600) return 32;
  if (chars > 400) return 38;
  if (chars > 250) return 46;
  if (chars > 130) return 58;
  return 68;
}

function estimateArabicLines(chars: number, fs: number, contentWidth: number): number {
  // Approx chars per line scales roughly inversely with fontSize.
  // Calibration: at fontSize 32 in 1080px content width ≈ 85 chars/line.
  const charsPerLine = Math.max(20, Math.round((85 * 32 * contentWidth) / (fs * 1080)));
  return Math.max(1, Math.ceil(chars / charsPerLine));
}

interface Dims {
  readonly width: number;
  readonly height: number;
  readonly contentWidth: number;
}
function computeDims(
  format: Format,
  variant: Variant,
  arabicChars: number,
  englishLen: number,
  tafsirLen: number,
  hasTransliteration: boolean,
  hasGrammar: boolean,
): Dims {
  let width: number;
  let baseChrome: number;
  if (format === 'story') {
    width = 1080;
    baseChrome = 360;
  } else if (format === 'square') {
    width = 1080;
    baseChrome = 320;
  } else {
    width = 1200;
    baseChrome = 320;
  }
  const contentWidth = width - 224; // outer 56*2 + inner card padding 56*2
  const fs = arabicFontSizeFor(format, variant, arabicChars);
  const arabicLines = estimateArabicLines(arabicChars, fs, contentWidth);
  const lineHeight = fs * 2.5;

  let arabicBlock = arabicLines * lineHeight + 30;
  if (variant === 'wbw') {
    // Each word chip ~110px tall; ~5–7 per row in 1080px content
    const cellsPerRow = Math.floor(contentWidth / 130);
    const wordCount = Math.ceil(arabicChars / 6);
    arabicBlock = Math.ceil(wordCount / cellsPerRow) * 110 + 60;
  }

  const englishBlock = englishLen > 0 ? Math.ceil(englishLen / 75) * 36 + 30 : 0;
  const translitBlock = hasTransliteration ? 60 : 0;
  const grammarBlock = hasGrammar ? 130 : 0;
  const tafsirBlock = tafsirLen > 0 ? Math.ceil(tafsirLen / 90) * 28 + 50 : 0;

  let height = baseChrome + arabicBlock + englishBlock + translitBlock + grammarBlock + tafsirBlock;

  // Format-specific aspect-ratio guards
  if (format === 'square') height = Math.max(height, width); // 1:1 minimum
  if (format === 'story') {
    // 9:16 minimum, but allow growth past the canonical 1920 if needed
    const target = Math.max(height, Math.round(width * (16 / 9)));
    height = target;
  } else {
    height = Math.max(height, 600);
  }
  height = Math.min(2200, Math.ceil(height));
  return { width, height, contentWidth };
}

// ---- GET handler -----------------------------------------------------

interface RouteCtx {
  readonly params: Promise<{ verseKey: string }>;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { verseKey: rawVk } = await ctx.params;
  let verseKey = rawVk;
  try {
    verseKey = decodeURIComponent(rawVk);
  } catch {
    return new Response('Bad verse key', { status: 400 });
  }
  if (!/^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/.test(verseKey)) {
    return new Response('Bad verse key', { status: 400 });
  }
  const surah = Number.parseInt(verseKey.split(':')[0] ?? '1', 10);

  const url = new URL(req.url);
  const format = asFormat(url.searchParams.get('format'));
  const variant = asVariant(url.searchParams.get('variant'));
  const layoutSlug = (url.searchParams.get('layout') ?? '').replace(/[^a-z0-9_]/g, '');
  const showTransliteration = url.searchParams.get('transliteration') === '1';
  const showGrammar = url.searchParams.get('grammar') === '1' || variant === 'advanced';
  const showTafsir = url.searchParams.get('tafsir') === '1' || variant === 'advanced';
  const isTajweedLayout = layoutSlug === 'kfgqpc_v4' || layoutSlug === 'tajweed';

  // Fetch only what this combination needs
  const needsTranslation = variant !== 'minimal' && variant !== 'wbw';
  const needsWbw = variant === 'wbw';
  const needsTafsir = showTafsir;
  const needsGrammar = showGrammar;
  const needsTajweed = isTajweedLayout;

  const [verse, meta, translation, wbw, tafsir, morphology, tajweed, fonts] = await Promise.all([
    fetchVerse(verseKey),
    fetchSurahMeta(surah),
    needsTranslation ? fetchTranslation(verseKey) : Promise.resolve(null),
    needsWbw ? fetchWbw(verseKey) : Promise.resolve(null),
    needsTafsir ? fetchTafsirSnippet(verseKey) : Promise.resolve(null),
    needsGrammar ? fetchMorphology(verseKey) : Promise.resolve(null),
    needsTajweed ? fetchTajweed(verseKey) : Promise.resolve(null),
    getFonts(),
  ]);

  if (!verse) return new Response('Verse not found', { status: 404 });

  const arabicSource = arabicTextFor(verse, layoutSlug);
  const arabicLen = arabicSource.length;

  // Dedup surah names that vary only by diacritics
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]/g, '');
  const surahName = meta
    ? norm(meta.nameEnglish) === norm(meta.nameTransliteration)
      ? meta.nameEnglish
      : `${meta.nameEnglish} · ${meta.nameTransliteration}`
    : `Surah ${surah.toString()}`;

  const englishTrim = (() => {
    if (!translation) return null;
    const max = format === 'story' ? 700 : variant === 'advanced' ? 240 : 380;
    return translation.length > max ? translation.slice(0, max - 1).trimEnd() + '…' : translation;
  })();

  const arabicFontSize = arabicFontSizeFor(format, variant, arabicLen);
  const dims = computeDims(
    format,
    variant,
    arabicLen,
    englishTrim?.length ?? 0,
    tafsir?.length ?? 0,
    showTransliteration,
    !!morphology && showGrammar,
  );

  // Compose tajweed-aware shaped Arabic. For tajweed mode we keep
  // logical-order char-segments, then per-segment shape+reverse so
  // colored runs stay visually contiguous after the RTL flip.
  const tajweedSegmentsRtl: readonly { text: string; color?: string }[] | null =
    needsTajweed && tajweed && tajweed.annotations.length > 0
      ? applyTajweed(arabicSource.replace(/[٠-٩۰-۹]+$/u, '').trim(), tajweed.annotations)
          .map((seg) => ({
            text: shapeWord(seg.text),
            color: seg.rule ? TAJWEED_COLOR[seg.rule] : undefined,
          }))
          .reverse()
      : null;

  const shapedWords = shapeVerse(arabicSource);
  const shapedBrand = shapeWord('كلام');

  // -- Render --

  const ArabicBlock = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap-reverse',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        marginTop: 24,
        fontSize: arabicFontSize,
        lineHeight: 2.5,
        color: '#0e0e0e',
        fontWeight: 500,
        fontFamily: 'NotoArabic, Inter, serif',
        gap: '0.45em',
        letterSpacing: '0.5px',
      }}
    >
      {tajweedSegmentsRtl
        ? tajweedSegmentsRtl.map((s, i) => (
            <span
              key={`tj-${i.toString()}`}
              style={{ display: 'flex', color: s.color ?? '#0e0e0e' }}
            >
              {s.text}
            </span>
          ))
        : shapedWords.map((w, i) => (
            <span key={`w-${i.toString()}`} style={{ display: 'flex' }}>
              {w}
            </span>
          ))}
    </div>
  );

  const TranslationBlock = englishTrim ? (
    <div
      style={{
        display: 'flex',
        marginTop: 22,
        fontSize: format === 'story' ? 28 : 22,
        lineHeight: 1.55,
        color: '#3a3a3a',
        fontStyle: 'italic',
      }}
    >
      “{englishTrim}”
    </div>
  ) : null;

  const WbwGrid =
    needsWbw && wbw && wbw.data.words.length > 0 ? (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap-reverse',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          gap: 14,
          marginTop: 22,
        }}
      >
        {[...wbw.data.words].reverse().map((w, i) => {
          const isAyahNumber = /^[٠-٩]+$/.test(w.textArabic);
          return (
            <div
              key={`wbw-${i.toString()}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px 14px',
                background: 'rgba(182,134,44,0.06)',
                border: '1px solid rgba(182,134,44,0.18)',
                borderRadius: 10,
                minWidth: 110,
                maxWidth: 220,
              }}
            >
              <span
                style={{
                  fontFamily: 'NotoArabic, Inter, serif',
                  fontSize: arabicFontSize * 0.9,
                  color: '#0e0e0e',
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                {shapeWord(w.textArabic)}
              </span>
              {!isAyahNumber && w.translation ? (
                <span
                  style={{
                    fontSize: 13,
                    color: '#3a3a3a',
                    marginTop: 6,
                    textAlign: 'center',
                  }}
                >
                  {w.translation}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    ) : null;

  const GrammarBlock = (() => {
    if (!showGrammar || !morphology) return null;
    const posCounts = new Map<string, number>();
    const roots: string[] = [];
    for (const w of morphology.words) {
      for (const t of w.tokens) {
        if (t.isStem) {
          posCounts.set(t.tag, (posCounts.get(t.tag) ?? 0) + 1);
          if (t.root) roots.push(t.root);
        }
      }
    }
    const topPos = Array.from(posCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const uniqueRoots = Array.from(new Set(roots)).slice(0, 10);
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 18,
          padding: '14px 18px',
          background: 'rgba(27,77,90,0.05)',
          borderRadius: 12,
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#1b4d5a',
              opacity: 0.65,
              fontWeight: 700,
            }}
          >
            Parts of speech
          </span>
          {topPos.map(([tag, n]) => (
            <span
              key={tag}
              style={{
                fontSize: 12,
                padding: '3px 10px',
                background: '#fff',
                border: '1px solid rgba(27,77,90,0.18)',
                borderRadius: 999,
                color: '#1b4d5a',
                fontWeight: 700,
                display: 'flex',
              }}
            >
              {tag} · {n.toString()}
            </span>
          ))}
        </div>
        {uniqueRoots.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: '#b6862c',
                fontWeight: 700,
              }}
            >
              Roots
            </span>
            {uniqueRoots.map((r) => (
              <span
                key={r}
                style={{
                  fontSize: 12,
                  color: '#3a3a3a',
                  fontVariantNumeric: 'tabular-nums',
                  display: 'flex',
                }}
              >
                {r}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  })();

  const TafsirBlock =
    showTafsir && tafsir ? (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 16,
          padding: '14px 18px',
          background: 'rgba(182,134,44,0.06)',
          borderLeft: '3px solid #b6862c',
          borderRadius: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#b6862c',
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Tafsir · Jalālayn
        </span>
        <span style={{ fontSize: 16, lineHeight: 1.55, color: '#3a3a3a', fontStyle: 'italic' }}>
          {tafsir}
        </span>
      </div>
    ) : null;

  // 2× DPR for sharpness: ImageResponse canvas is dims × 2; the JSX
  // root keeps its logical dimensions and transforms by scale(2). All
  // CSS values stay sane at the authored size.
  const DPR = 2;

  return new ImageResponse(
    <div
      style={{
        height: dims.height,
        width: dims.width,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #1b4d5a 0%, #143842 50%, #0e2a32 100%)',
        color: '#1a1a1a',
        position: 'relative',
        padding: format === 'story' ? 48 : 56,
        transform: `scale(${DPR.toString()})`,
        transformOrigin: 'top left',
      }}
    >
      {/* Gold ornament glows */}
      <div
        style={{
          position: 'absolute',
          top: -160,
          right: -160,
          width: 480,
          height: 480,
          borderRadius: 9999,
          background:
            'radial-gradient(circle at center, rgba(182,134,44,0.32) 0%, rgba(182,134,44,0) 60%)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -180,
          left: -180,
          width: 480,
          height: 480,
          borderRadius: 9999,
          background:
            'radial-gradient(circle at center, rgba(182,134,44,0.18) 0%, rgba(182,134,44,0) 60%)',
          display: 'flex',
        }}
      />
      {/* Inner manuscript card */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(170deg, #faf7f0 0%, #f4ecd9 100%)',
          borderRadius: 28,
          padding: format === 'story' ? '40px 44px 32px' : '46px 60px 38px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.7)',
          border: '1px solid rgba(182,134,44,0.18)',
        }}
      >
        {/* Brand row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span
              style={{
                fontSize: 38,
                color: '#1b4d5a',
                fontWeight: 700,
                fontFamily: 'NotoArabic, Inter, serif',
                lineHeight: 1,
              }}
            >
              {shapedBrand}
            </span>
            <span
              style={{
                fontSize: 12,
                letterSpacing: 6,
                textTransform: 'uppercase',
                color: '#1b4d5a',
                opacity: 0.65,
                fontWeight: 700,
              }}
            >
              Qalaam
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {variant !== 'translation' ? (
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  color: '#b6862c',
                  fontWeight: 800,
                  padding: '4px 10px',
                  background: 'rgba(182,134,44,0.08)',
                  border: '1px solid rgba(182,134,44,0.25)',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {variant.toUpperCase()}
              </span>
            ) : null}
            {layoutSlug ? (
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: '#1b4d5a',
                  opacity: 0.55,
                  padding: '4px 9px',
                  background: 'rgba(27,77,90,0.06)',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 700,
                }}
              >
                {layoutSlug.replace(/_/g, ' ')}
              </span>
            ) : null}
            <span
              style={{
                fontSize: 11,
                letterSpacing: 5,
                textTransform: 'uppercase',
                color: '#1b4d5a',
                opacity: 0.55,
                fontWeight: 600,
                display: 'flex',
              }}
            >
              {surahName}
            </span>
            <span
              style={{
                fontSize: 12,
                letterSpacing: 2,
                color: '#b6862c',
                fontWeight: 800,
                padding: '5px 14px',
                background: 'rgba(182,134,44,0.12)',
                border: '1px solid rgba(182,134,44,0.35)',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {verseKey}
            </span>
          </div>
        </div>
        {/* Hairline divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 24,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(27,77,90,0.18) 50%, transparent 100%)',
              display: 'flex',
            }}
          />
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 9999,
              background: '#b6862c',
              opacity: 0.6,
              display: 'flex',
            }}
          />
          <div
            style={{
              flex: 1,
              height: 1,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(27,77,90,0.18) 50%, transparent 100%)',
              display: 'flex',
            }}
          />
        </div>

        {variant === 'wbw' ? WbwGrid : ArabicBlock}
        {variant !== 'minimal' && variant !== 'wbw' ? TranslationBlock : null}
        {GrammarBlock}
        {TafsirBlock}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: 'auto',
            paddingTop: 14,
            borderTop: '1px solid rgba(27,77,90,0.15)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: 5,
                textTransform: 'uppercase',
                color: '#b6862c',
                fontWeight: 800,
              }}
            >
              Read · Listen · Memorize
            </span>
            <span style={{ fontSize: 15, color: '#1b4d5a', fontWeight: 600 }}>qalaam.app</span>
          </div>
          <span style={{ fontSize: 12, color: '#888' }}>Quran · QUL · Saheeh International</span>
        </div>
      </div>
    </div>,
    {
      width: dims.width * DPR,
      height: dims.height * DPR,
      fonts: fonts.map((f) => ({ ...f })),
      headers: {
        'cache-control': 'public, max-age=604800, s-maxage=604800, immutable',
      },
    },
  );
}
