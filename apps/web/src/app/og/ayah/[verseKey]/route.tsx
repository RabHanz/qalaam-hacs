/**
 * /og/ayah/[verseKey] — Satori-rendered shareable ayah card.
 *
 * Path lives outside `/api/*` so the next.config.mjs rewrite doesn't
 * proxy it to the backend.
 *
 * Variants (?variant=...):
 *   - default     Arabic + English translation snippet (1200×630 OG)
 *   - full        Arabic + ENTIRE English translation, height grows
 *   - wbw         Arabic with per-word English glosses + roots
 *   - advanced    Arabic + translation + grammar tags + tafsir snippet
 *   - story       Portrait 1080×1920 for IG/WhatsApp status
 *
 * Why Satori (via `next/og`): server-rendered, no headless browser,
 * deterministic. Per ADR-0017.
 *
 * Arabic shaping: see scripts/data/strip-arabic-font-gsub.py +
 * arabic-persian-reshaper. Combined with flex-wrap: wrap-reverse on
 * the line container, this gives correct RTL reading order top-down
 * even though Satori has no bidi engine.
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

interface WbwToken {
  readonly form: string;
  readonly translation: string | null;
}
interface WbwWord {
  readonly wordIndex: number;
  readonly tokens: readonly WbwToken[];
}
interface WbwResp {
  readonly words: readonly WbwWord[];
}

interface RouteCtx {
  readonly params: Promise<{ verseKey: string }>;
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

async function fetchVerse(vk: string): Promise<Verse | null> {
  return fetchJson<Verse>(`${API_BASE}/v1/verses/by_key/${encodeURIComponent(vk)}`);
}

async function fetchSurahMeta(surah: number): Promise<SurahInfo | null> {
  const body = await fetchJson<{ data?: SurahInfo[] }>(`${API_BASE}/v1/metadata/surahs`);
  return body?.data?.find((s) => s.surah === surah) ?? null;
}

async function fetchTranslation(vk: string): Promise<string | null> {
  const body = await fetchJson<{ text?: string }>(
    `${API_BASE}/v1/translations/saheeh-international/${encodeURIComponent(vk)}`,
  );
  return body?.text ?? null;
}

async function fetchMorphology(vk: string): Promise<MorphologyResp | null> {
  return fetchJson<MorphologyResp>(`${API_BASE}/v1/morphology/${encodeURIComponent(vk)}`);
}

async function fetchWbw(vk: string): Promise<WbwResp | null> {
  return fetchJson<WbwResp>(`${API_BASE}/v1/wbw/${encodeURIComponent(vk)}`);
}

type Variant = 'default' | 'full' | 'wbw' | 'advanced' | 'story';

/**
 * Compute card dimensions per variant + content length. For non-story
 * variants we grow the height with the ayah so long passages don't
 * clip and the diacritics get enough vertical room.
 *
 * Approximate Arabic line count by char-density per line at the chosen
 * font size; Arabic at 32pt fits ~85 chars/line in our 1080px content
 * width, scaling roughly linearly with fontSize.
 */
function estimateArabicLines(arabicChars: number, fontSize: number): number {
  // Rough chars-per-line at 1080px content width.
  // At fontSize 32 ~= 85 chars; at 72 ~= 32 chars; scales as 1/fontSize.
  const charsPerLine = Math.max(20, Math.round((85 * 32) / fontSize));
  return Math.max(1, Math.ceil(arabicChars / charsPerLine));
}

function arabicFontSizeFor(variant: Variant, arabicChars: number): number {
  if (variant === 'story') {
    if (arabicChars > 600) return 38;
    if (arabicChars > 250) return 50;
    return 62;
  }
  if (variant === 'wbw' || variant === 'advanced') {
    if (arabicChars > 600) return 32;
    if (arabicChars > 300) return 40;
    return 50;
  }
  if (arabicChars > 600) return 32;
  if (arabicChars > 400) return 38;
  if (arabicChars > 250) return 46;
  if (arabicChars > 130) return 58;
  return 72;
}

function computeDims(
  variant: Variant,
  arabicChars: number,
  englishLen: number,
): { width: number; height: number } {
  if (variant === 'story') return { width: 1080, height: 1920 };
  const width = 1200;
  // Empirical chrome budget — measured against the live render so the
  // footer never overlaps content:
  //   inner card padding (top+bottom): ~90
  //   brand row: ~50
  //   divider: ~30
  //   footer + its top margin: ~80
  //   outer page padding: 56 × 2 = 112
  //   safety margin: ~40
  const baseChrome = 400;
  const englishBlock =
    englishLen > 0 && variant !== 'wbw'
      ? // ~75 chars per line at 22px italic English including padding
        Math.ceil(englishLen / 75) * 38 + 30
      : 0;
  const advBlock = variant === 'advanced' ? 160 : 0;
  const fs = arabicFontSizeFor(variant, arabicChars);
  const arabicLines = estimateArabicLines(arabicChars, fs);
  // Each line's vertical footprint = font * line-height (2.4 in our
  // wrap-reverse flex; bump to 2.5 to add diacritic safety).
  const lineHeight = fs * 2.5;
  const arabicBlock =
    variant === 'wbw'
      ? // each WBW chip: ~110px tall, ~10 per row at width 1080
        Math.ceil(arabicChars / 80) * 130 + 200
      : arabicLines * lineHeight + 32;
  const computed = baseChrome + arabicBlock + englishBlock + advBlock;
  const minH = variant === 'default' ? 630 : 720;
  const maxH = variant === 'wbw' ? 1800 : 1500;
  const height = Math.max(minH, Math.min(maxH, Math.ceil(computed)));
  return { width, height };
}

function asVariant(s: string | null | undefined): Variant {
  if (s === 'full' || s === 'wbw' || s === 'advanced' || s === 'story') return s;
  return 'default';
}

/**
 * Pre-shape Arabic for Satori-without-bidi: convert each word to
 * Presentation Forms-A/B, reverse intra-word codepoints, return as a
 * `wrap-reverse` flex item array so wrapped lines stack bottom-up and
 * read top-down in correct RTL order.
 */
function shapeArabicWords(text: string): readonly string[] {
  const stripped = text.replace(/[٠-٩۰-۹]+$/u, '').trim();
  return stripped
    .split(/\s+/)
    .map((w) => reshaper.convertArabic(w))
    .map((w) => Array.from(w).reverse().join(''))
    .reverse();
}

function shapeArabicWord(text: string): string {
  return Array.from(reshaper.convertArabic(text)).reverse().join('');
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
  const url = new URL(req.url);
  const variant = asVariant(url.searchParams.get('variant'));
  const surah = Number.parseInt(verseKey.split(':')[0] ?? '1', 10);

  // Fetch what each variant needs in parallel.
  const needsMorphology = variant === 'wbw' || variant === 'advanced';
  const [verse, meta, translation, morphology, wbw, fonts] = await Promise.all([
    fetchVerse(verseKey),
    fetchSurahMeta(surah),
    fetchTranslation(verseKey),
    needsMorphology ? fetchMorphology(verseKey) : Promise.resolve(null),
    variant === 'wbw' ? fetchWbw(verseKey) : Promise.resolve(null),
    getFonts(),
  ]);

  if (!verse) {
    return new Response('Verse not found', { status: 404 });
  }

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

  const shapedWords = shapeArabicWords(verse.textUthmani);
  const shapedBrand = shapeArabicWord('كلام');

  // English handling — full variant gets the entire translation; others
  // get truncated for compact card.
  const englishMaxLen = variant === 'full' ? 1200 : variant === 'story' ? 600 : 320;
  const englishTrim =
    translation && translation.length > englishMaxLen
      ? translation.slice(0, englishMaxLen - 3).trimEnd() + '…'
      : translation;

  const dims = computeDims(variant, verse.textUthmani.length, englishTrim?.length ?? 0);

  // Sizing tuned per variant + content length.
  const arabicFontSize = arabicFontSizeFor(variant, verse.textUthmani.length);

  // Build the inner content depending on variant.
  let innerContent: React.ReactNode = null;

  if (variant === 'wbw') {
    const wbwGrid = wbw?.words ?? [];
    innerContent = (
      <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: 18, marginTop: 18 }}>
        {wbwGrid
          .slice()
          .reverse()
          .map((w, i) => {
            const stem = w.tokens.find((t) => t.translation) ?? w.tokens[0];
            return (
              <div
                key={`${i.toString()}-wbw`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'rgba(182,134,44,0.06)',
                  border: '1px solid rgba(182,134,44,0.18)',
                  borderRadius: 10,
                  minWidth: 96,
                }}
              >
                <span
                  style={{
                    fontFamily: 'NotoArabic, Inter, serif',
                    fontSize: arabicFontSize * 0.85,
                    color: '#0e0e0e',
                    fontWeight: 500,
                  }}
                >
                  {shapeArabicWord(w.tokens.map((t) => t.form).join(''))}
                </span>
                {stem?.translation ? (
                  <span
                    style={{
                      fontSize: 13,
                      color: '#3a3a3a',
                      marginTop: 4,
                      textAlign: 'center',
                    }}
                  >
                    {stem.translation}
                  </span>
                ) : null}
              </div>
            );
          })}
      </div>
    );
  } else if (variant === 'advanced') {
    // Build a compact "grammar legend" — count of POS tags + roots.
    const posCounts = new Map<string, number>();
    const roots: string[] = [];
    morphology?.words.forEach((w) => {
      w.tokens.forEach((t) => {
        if (t.isStem) {
          posCounts.set(t.tag, (posCounts.get(t.tag) ?? 0) + 1);
          if (t.root) roots.push(t.root);
        }
      });
    });
    const topPos = Array.from(posCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const uniqueRoots = Array.from(new Set(roots)).slice(0, 8);
    innerContent = (
      <>
        {/* Arabic */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap-reverse',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            marginTop: 18,
            fontSize: arabicFontSize,
            lineHeight: 2.2,
            color: '#0e0e0e',
            fontFamily: 'NotoArabic, Inter, serif',
            gap: '0.4em',
            letterSpacing: '0.5px',
          }}
        >
          {shapedWords.map((w, i) => (
            <span key={`${i.toString()}-${w}`} style={{ display: 'flex' }}>
              {w}
            </span>
          ))}
        </div>
        {/* Translation */}
        {englishTrim ? (
          <div
            style={{
              display: 'flex',
              marginTop: 14,
              fontSize: 19,
              lineHeight: 1.5,
              color: '#3a3a3a',
              fontStyle: 'italic',
              maxHeight: 110,
              overflow: 'hidden',
            }}
          >
            “{englishTrim}”
          </div>
        ) : null}
        {/* Grammar strip */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 16,
            padding: '14px 18px',
            background: 'rgba(27,77,90,0.05)',
            borderRadius: 10,
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: '#1b4d5a',
                opacity: 0.6,
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
                }}
              >
                {tag} · {n.toString()}
              </span>
            ))}
          </div>
          {uniqueRoots.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </>
    );
  } else {
    // default + full + story all share the same Arabic+English layout,
    // height/font-size differ.
    innerContent = (
      <>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap-reverse',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            marginTop: 24,
            fontSize: arabicFontSize,
            lineHeight: 2.4,
            color: '#0e0e0e',
            fontWeight: 500,
            fontFamily: 'NotoArabic, Inter, serif',
            gap: '0.45em',
            letterSpacing: '0.5px',
          }}
        >
          {shapedWords.map((w, i) => (
            <span key={`${i.toString()}-${w}`} style={{ display: 'flex' }}>
              {w}
            </span>
          ))}
        </div>
        {englishTrim ? (
          <div
            style={{
              display: 'flex',
              marginTop: 22,
              paddingTop: 14,
              fontSize: variant === 'story' ? 28 : 22,
              lineHeight: 1.55,
              color: '#3a3a3a',
              fontStyle: 'italic',
            }}
          >
            “{englishTrim}”
          </div>
        ) : null}
      </>
    );
  }

  // Render at 2× DPR for retina sharpness. We keep the JSX authored
  // at logical dimensions (so all CSS values stay sane) and apply a
  // single transform: scale(2) on the root, with the ImageResponse
  // canvas doubled. The output PNG is 2× wider/taller; platforms
  // downscale on display so text stays crisp on high-DPI screens.
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
        padding: variant === 'story' ? 48 : 56,
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
          padding: variant === 'story' ? '40px 44px 32px' : '46px 60px 38px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {variant !== 'default' ? (
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
            <span
              style={{
                fontSize: 11,
                letterSpacing: 5,
                textTransform: 'uppercase',
                color: '#1b4d5a',
                opacity: 0.55,
                fontWeight: 600,
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

        {innerContent}

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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
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
