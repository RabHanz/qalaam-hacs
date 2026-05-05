/**
 * ShareCardSurface — the print-ready ayah card layout.
 *
 * Reuses the same typography, tajweed CSS, and editorial language as
 * /read so the screenshotted output matches what users actually see in
 * the app. Per-format dimensions: landscape 1200×variable, square 1080,
 * story 1080×1920.
 *
 * The OG screenshotter loads /share-card/[vk]?format=&variant=… and
 * captures the .share-card root, so all sizing here lives on that
 * single element.
 */
import {
  POS_LABEL,
  displayableFeatures,
  featureChipLabel,
  lemmaDisplay,
  posClass,
  rootBuckwalterToArabic,
  tokenRoleLabel,
  type MorphologyToken,
  type MorphologyWord as DisplayMorphologyWord,
} from '../lib/morphology-display.js';
import { sanitizeHtml } from '../lib/sanitize-html.js';
import { applyTajweed, type TajweedAnnotation } from '../lib/tajweed.js';

import type { ReactNode } from 'react';

interface SurahMeta {
  readonly surah: number;
  readonly nameEnglish: string;
  readonly nameArabic: string;
  readonly nameTransliteration: string;
}
interface Verse {
  readonly verseKey: string;
  readonly textUthmani: string;
  readonly textIndopak: string | null;
  readonly textImlaei: string | null;
}
interface WbwWord {
  readonly verseKey: string;
  readonly wordIndex: number;
  readonly textArabic: string;
  readonly translation: string | null;
}
// Morphology types live in lib/morphology-display.ts so /study and
// /share-card share the same source of truth (per memory rule
// `feedback_quranic_authenticity.md`). Re-export the type alias here
// to avoid a cross-cutting rename in the Props interface below.
type MorphologyWord = DisplayMorphologyWord;

interface Props {
  readonly verseKey: string;
  readonly surah: number;
  readonly surahMeta: SurahMeta | null;
  readonly verse: Verse;
  readonly translation: string | null;
  readonly transliteration: string | null;
  readonly wbw: readonly WbwWord[] | null;
  readonly tafsir: string | null;
  readonly tafsirScholar: string | null;
  readonly morphology: readonly MorphologyWord[] | null;
  readonly tajweedAnnotations: readonly TajweedAnnotation[] | null;
  readonly format: 'landscape' | 'square' | 'story';
  readonly variant: 'minimal' | 'translation' | 'wbw' | 'advanced';
  readonly layoutSlug: string;
  readonly showTransliteration: boolean;
  readonly showGrammar: boolean;
  readonly showTafsir: boolean;
  /** When true, the card collapses to its content's natural height
   *  instead of holding the format's aspect-ratio min-height. Useful
   *  for sharing minimal verses without an empty bottom half. */
  readonly fit: boolean;
  /** Content scale multiplier (1, 1.25, 1.5). Enlarges Arabic + body
   *  text proportionally without changing the card width. */
  readonly scale: number;
}

// POS_LABEL imported from lib/morphology-display.ts

/**
 * Human-readable labels for the share-card pills. Mirrors the
 * `LAYOUT_LABELS` dict in components/LayoutSwitcher.tsx + the
 * `VARIANTS` table in components/ShareDialog.tsx so the pills inside
 * the card match the names users see on /read and in the share sheet.
 */
const LAYOUT_LABEL_FOR_CARD: Record<string, string> = {
  madani_15: 'Madani 15-line',
  madani_16: 'Madani 16-line',
  indopak: 'IndoPak',
  indopak_13: 'IndoPak 13-line',
  indopak_15: 'IndoPak 15-line',
  indopak_16: 'IndoPak 16-line',
  kfgqpc_v1: 'IndoPak (KFGQPC)',
  kfgqpc_v4: 'KFGQPC v4',
  tajweed: 'Tajweed',
  nastaleeq_15: 'Nastaleeq',
};

const VARIANT_LABEL_FOR_CARD: Record<string, string> = {
  minimal: 'Verse only',
  translation: 'With translation',
  wbw: 'Word-by-word',
  advanced: 'Advanced',
};

function layoutLabel(slug: string): string {
  return LAYOUT_LABEL_FOR_CARD[slug] ?? slug.replace(/_/g, ' ');
}

function variantLabel(v: string): string {
  return VARIANT_LABEL_FOR_CARD[v] ?? v;
}

function arabicTextFor(verse: Verse, layoutSlug: string): string {
  if (layoutSlug === 'kfgqpc_v1' || layoutSlug === 'indopak' || layoutSlug.includes('indopak')) {
    return verse.textIndopak ?? verse.textUthmani;
  }
  if (layoutSlug === 'kfgqpc_v4' || layoutSlug === 'tajweed') {
    return verse.textImlaei ?? verse.textUthmani;
  }
  return verse.textUthmani;
}

function fontFamilyFor(layoutSlug: string): string {
  if (layoutSlug === 'kfgqpc_v1' || layoutSlug === 'indopak') {
    return '"Noto Nastaliq Urdu", "Scheherazade New", "Noto Naskh Arabic", serif';
  }
  return '"UthmanicHafs", "Amiri Quran", "Noto Naskh Arabic", serif';
}

export function ShareCardSurface(props: Props): ReactNode {
  const {
    verseKey,
    surah,
    surahMeta,
    verse,
    translation,
    transliteration,
    wbw,
    tafsir,
    tafsirScholar,
    morphology,
    tajweedAnnotations,
    format,
    variant,
    layoutSlug,
    showTransliteration,
    showGrammar,
    showTafsir,
    fit,
    scale,
  } = props;

  const arabic = arabicTextFor(verse, layoutSlug);
  const fontFamily = fontFamilyFor(layoutSlug);
  const isTajweed = layoutSlug === 'tajweed' || layoutSlug === 'kfgqpc_v4';

  const norm = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]/g, '');
  const surahName = surahMeta
    ? norm(surahMeta.nameEnglish) === norm(surahMeta.nameTransliteration)
      ? surahMeta.nameEnglish
      : `${surahMeta.nameEnglish} · ${surahMeta.nameTransliteration}`
    : `Surah ${surah.toString()}`;

  // Format dimensions (CSS pixels). Puppeteer uses
  // deviceScaleFactor=2 to get 2× sharpness in the output PNG.
  // When `fit` is on, we drop the format's min-height so the card
  // collapses to its content (avoiding empty bottom space). Otherwise
  // the canonical aspect ratio is preserved and content is centered
  // vertically within the available space.
  const dims = (() => {
    if (format === 'square') return { width: 1080, minHeight: 1080 };
    if (format === 'story') return { width: 1080, minHeight: 1920 };
    return { width: 1200, minHeight: 630 };
  })();
  const effectiveMinHeight = fit ? 0 : dims.minHeight;

  return (
    <main
      className="share-card paper-texture"
      data-share-card="1"
      data-fit={fit ? '1' : '0'}
      style={{
        width: dims.width,
        minHeight: effectiveMinHeight,
        margin: 0,
        padding: 0,
        background: 'linear-gradient(160deg, #1b4d5a 0%, #143842 50%, #0e2a32 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-body, "Inter", system-ui, sans-serif)',
      }}
    >
      {/* Gold ornament glows */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -160,
          right: -160,
          width: 480,
          height: 480,
          borderRadius: 9999,
          background:
            'radial-gradient(circle at center, rgba(182,134,44,0.32) 0%, rgba(182,134,44,0) 60%)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -180,
          left: -180,
          width: 480,
          height: 480,
          borderRadius: 9999,
          background:
            'radial-gradient(circle at center, rgba(182,134,44,0.18) 0%, rgba(182,134,44,0) 60%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          padding: format === 'story' ? '52px 56px' : '60px 72px',
          minHeight: effectiveMinHeight,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Inner manuscript card */}
        <article
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(170deg, #faf7f0 0%, #f4ecd9 100%)',
            borderRadius: 28,
            padding: format === 'story' ? '40px 44px 32px' : '46px 60px 38px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.7)',
            border: '1px solid rgba(182,134,44,0.18)',
            color: '#1a1a1a',
          }}
        >
          {/* Brand row */}
          <header
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span
                dir="rtl"
                lang="ar"
                style={{
                  fontFamily,
                  fontSize: 36,
                  color: '#1b4d5a',
                  fontWeight: 700,
                  lineHeight: 1,
                  unicodeBidi: 'plaintext',
                }}
              >
                كَلَام
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              {variant !== 'translation' ? (
                <Pill color="gold" tone="filled">
                  {variantLabel(variant)}
                </Pill>
              ) : null}
              {layoutSlug ? (
                <Pill color="leaf" tone="ghost">
                  {layoutLabel(layoutSlug)}
                </Pill>
              ) : null}
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 5,
                  textTransform: 'uppercase',
                  color: '#1b4d5a',
                  opacity: 0.6,
                  fontWeight: 600,
                }}
              >
                {surahName}
              </span>
              <Pill color="gold" tone="ring">
                <span style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                  {verseKey}
                </span>
              </Pill>
            </div>
          </header>

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
              }}
            />
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 9999,
                background: '#b6862c',
                opacity: 0.6,
              }}
            />
            <div
              style={{
                flex: 1,
                height: 1,
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(27,77,90,0.18) 50%, transparent 100%)',
              }}
            />
          </div>

          {/* Arabic + WBW + insights — flex:1 + justifyContent:center
              so content stays vertically centered when the card has
              extra room (e.g. story format with a short verse). */}
          <section
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: fit ? 'flex-start' : 'center',
              gap: 18,
              marginTop: 26,
            }}
          >
            {variant === 'wbw' && wbw && wbw.length > 0 ? (
              <WbwGrid
                wbw={wbw}
                fontFamily={fontFamily}
                arabicSize={Math.round(pickArabicSize(format, arabic.length, true) * scale)}
              />
            ) : (
              <ArabicVerse
                arabic={arabic}
                fontFamily={fontFamily}
                fontSize={Math.round(pickArabicSize(format, arabic.length, false) * scale)}
                tajweedAnnotations={isTajweed ? tajweedAnnotations : null}
              />
            )}
            {showTransliteration && transliteration ? (
              <Transliteration text={transliteration} format={format} scale={scale} />
            ) : null}
            {variant !== 'minimal' && variant !== 'wbw' && translation ? (
              <Translation text={translation} format={format} scale={scale} />
            ) : null}
            {showGrammar && morphology ? (
              <WordGrammarGrid morphology={morphology} fontFamily={fontFamily} />
            ) : null}
            {showTafsir && tafsir ? <TafsirSnippet text={tafsir} scholar={tafsirScholar} /> : null}
          </section>

          <footer
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid rgba(27,77,90,0.15)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
            <span style={{ fontSize: 12, color: '#7a7a7a' }}>
              Quran · QUL · Saheeh International
            </span>
          </footer>
        </article>
      </div>
    </main>
  );
}

/** Verse Arabic with optional tajweed colorization (per-word so glyph
 * joining is preserved within each word). */
function ArabicVerse({
  arabic,
  fontFamily,
  fontSize,
  tajweedAnnotations,
}: {
  readonly arabic: string;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly tajweedAnnotations: readonly TajweedAnnotation[] | null;
}): ReactNode {
  const baseStyle = {
    fontFamily,
    fontSize,
    lineHeight: 1.95,
    color: '#0e0e0e',
    fontWeight: 600 as const,
    unicodeBidi: 'plaintext' as const,
    textAlign: 'right' as const,
    margin: 0,
    wordBreak: 'normal' as const,
  };
  // No tajweed → plain paragraph, real GSUB shaping in the browser.
  if (!tajweedAnnotations || tajweedAnnotations.length === 0) {
    return (
      <p dir="rtl" lang="ar" style={baseStyle}>
        {arabic}
      </p>
    );
  }
  // Tajweed: split into words, apply annotations PER WORD so each word
  // remains its own joining context. Splitting letters across DOM
  // boundaries breaks Arabic glyph-joining.
  const words = arabic.split(/(\s+)/);
  let charCursor = 0;
  const nodes: ReactNode[] = [];
  for (let wi = 0; wi < words.length; wi += 1) {
    const word = words[wi] ?? '';
    if (word.length === 0) continue;
    if (/^\s+$/.test(word)) {
      nodes.push(word);
      charCursor += word.length;
      continue;
    }
    const wStart = charCursor;
    const wEnd = wStart + word.length;
    const local = tajweedAnnotations
      .filter((a) => a.end > wStart && a.start < wEnd)
      .map((a) => ({
        start: Math.max(0, a.start - wStart),
        end: Math.min(word.length, a.end - wStart),
        rule: a.rule,
      }));
    if (local.length === 0) {
      nodes.push(<span key={`tw-${wi.toString()}`}>{word}</span>);
    } else {
      const segs = applyTajweed(word, local);
      nodes.push(
        <span key={`tw-${wi.toString()}`}>
          {segs.map((seg, si) => (
            <span
              key={`tw-${wi.toString()}-s${si.toString()}`}
              className={seg.rule ? `tajweed-${seg.rule}` : undefined}
            >
              {seg.text}
            </span>
          ))}
        </span>,
      );
    }
    charCursor = wEnd;
  }
  return (
    <p dir="rtl" lang="ar" style={baseStyle}>
      {nodes}
    </p>
  );
}

function WbwGrid({
  wbw,
  fontFamily,
  arabicSize,
}: {
  readonly wbw: readonly WbwWord[];
  readonly fontFamily: string;
  readonly arabicSize: number;
}): ReactNode {
  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        unicodeBidi: 'plaintext',
        margin: 0,
        padding: 0,
      }}
    >
      {wbw.map((w) => {
        const isAyahNumber = /^[٠-٩]+$/.test(w.textArabic);
        return (
          <div
            key={`${w.verseKey}-${w.wordIndex.toString()}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '14px 16px',
              background: 'rgba(182,134,44,0.06)',
              border: '1px solid rgba(182,134,44,0.18)',
              borderRadius: 12,
              minWidth: 110,
              maxWidth: 240,
            }}
          >
            <span
              dir="rtl"
              lang="ar"
              style={{
                fontFamily,
                fontSize: arabicSize,
                color: '#0e0e0e',
                fontWeight: 600,
                lineHeight: 1.4,
                unicodeBidi: 'plaintext',
              }}
            >
              {w.textArabic}
            </span>
            {!isAyahNumber && w.translation ? (
              <span
                dir="ltr"
                lang="en"
                style={{
                  fontSize: 13,
                  color: '#3a3a3a',
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
  );
}

function Transliteration({
  text,
  format,
  scale = 1,
}: {
  readonly text: string;
  readonly format: 'landscape' | 'square' | 'story';
  readonly scale?: number;
}): ReactNode {
  return (
    <p
      dir="ltr"
      lang="en"
      style={{
        fontSize: Math.round((format === 'story' ? 22 : 18) * scale),
        lineHeight: 1.6,
        color: '#5a5a5a',
        fontStyle: 'italic',
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

function Translation({
  text,
  format,
  scale = 1,
}: {
  readonly text: string;
  readonly format: 'landscape' | 'square' | 'story';
  readonly scale?: number;
}): ReactNode {
  return (
    <p
      dir="ltr"
      lang="en"
      style={{
        fontSize: Math.round((format === 'story' ? 26 : 22) * scale),
        lineHeight: 1.55,
        color: '#3a3a3a',
        fontStyle: 'italic',
        margin: 0,
      }}
    >
      “{text}”
    </p>
  );
}

function TafsirSnippet({
  text,
  scholar,
}: {
  readonly text: string;
  readonly scholar: string | null;
}): ReactNode {
  return (
    <div
      style={{
        padding: '14px 18px',
        background: 'rgba(182,134,44,0.06)',
        borderLeft: '3px solid #b6862c',
        borderRadius: 4,
      }}
    >
      <p
        style={{
          fontSize: 10,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: '#b6862c',
          fontWeight: 700,
          margin: '0 0 6px',
        }}
      >
        Tafsir{scholar ? ` · ${scholar}` : ''}
      </p>
      <div
        className="tafsir-prose"
        style={{ fontSize: 15, lineHeight: 1.55, color: '#3a3a3a', fontStyle: 'italic' }}
        // Tafsir comes from QUL with inline scholarly markup
        // (.qpc-hafs spans for embedded Quran). Sanitize through our
        // allowlist before injecting.
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
      />
    </div>
  );
}

/**
 * WordGrammarGrid — faithful port of MorphologyPane's word grid for
 * the static share-card. Per memory `feedback_quranic_authenticity.md`:
 *  - Combined Arabic word built from ALL token forms (never just stem).
 *  - One POS chip PER TOKEN with `posClass()` colour.
 *  - Token role (prefix / stem / suffix) labelled inline.
 *  - Lemma + root + i'rab features (case / gender / number / mood …)
 *    all surfaced because the screenshot can't tap-expand.
 */
function WordGrammarGrid({
  morphology,
  fontFamily,
}: {
  readonly morphology: readonly MorphologyWord[];
  readonly fontFamily: string;
}): ReactNode {
  return (
    <ol
      dir="rtl"
      lang="ar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 14,
        listStyle: 'none',
        padding: '14px 16px',
        margin: 0,
        background: 'rgba(27,77,90,0.05)',
        borderRadius: 12,
        unicodeBidi: 'plaintext',
      }}
    >
      {morphology.map((w) => {
        if (w.tokens.length === 0) return null;
        // Combined Arabic word — concatenate every token's `form` so
        // prefix + stem + suffix render as one joined glyph cluster.
        const combinedArabic = w.tokens.map((t) => t.form).join('');
        return (
          <li
            key={w.wordIndex}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '12px 14px',
              minWidth: 110,
              maxWidth: 260,
              background: '#fff',
              border: '1px solid rgba(27,77,90,0.18)',
              borderRadius: 10,
            }}
          >
            {/* Combined word in mushaf-grade Arabic */}
            <span
              dir="rtl"
              lang="ar"
              style={{
                fontFamily,
                fontSize: 28,
                color: '#0e0e0e',
                fontWeight: 600,
                lineHeight: 1.5,
                unicodeBidi: 'plaintext',
                textAlign: 'center',
              }}
            >
              {combinedArabic}
            </span>

            {/* One POS chip per token — colour-coded by posClass */}
            <div
              dir="rtl"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 4,
                unicodeBidi: 'plaintext',
              }}
            >
              {w.tokens.map((t) => (
                <PosChip key={t.tokenIndex} token={t} />
              ))}
            </div>

            {/* Per-token detail: role + lemma + root + features */}
            <div
              dir="ltr"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                width: '100%',
                marginTop: 4,
                paddingTop: 6,
                borderTop: '1px solid rgba(27,77,90,0.08)',
              }}
            >
              {w.tokens.map((t) => (
                <TokenDetail key={t.tokenIndex} token={t} fontFamily={fontFamily} />
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Single POS chip — wraps the corpus tag with the same colour
 *  classes (`pos-chip pos-verb` etc.) the live `MorphologyPane` uses,
 *  so the share screenshot inherits the same visual language. */
function PosChip({ token }: { readonly token: MorphologyToken }): ReactNode {
  const role = tokenRoleLabel(token);
  return (
    <span
      className={`pos-chip ${posClass(token.tag)}`}
      title={`${POS_LABEL[token.tag] ?? token.tag}${role ? ` · ${role}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        letterSpacing: 1.5,
        padding: '3px 8px',
        borderRadius: 6,
        fontWeight: 700,
        textTransform: 'uppercase',
        // Inline fallback colours so the chip reads even if the live
        // .pos-* CSS rules aren't in scope (Puppeteer screenshot uses
        // them; defensive against headless missing-style edge cases).
        background: 'rgba(27,77,90,0.08)',
        color: '#1b4d5a',
      }}
    >
      {POS_LABEL[token.tag] ?? token.tag}
    </span>
  );
}

/** Per-token expanded detail — role, lemma (Arabic + Buckwalter
 *  display), root (Buckwalter + Arabic letter form), i'rab features. */
function TokenDetail({
  token,
  fontFamily,
}: {
  readonly token: MorphologyToken;
  readonly fontFamily: string;
}): ReactNode {
  const role = tokenRoleLabel(token);
  const features = displayableFeatures(token.features);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span
        style={{
          fontSize: 9,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: '#1b4d5a',
          opacity: 0.7,
          fontWeight: 700,
        }}
      >
        {POS_LABEL[token.tag] ?? token.tag}
        {role ? ` · ${role}` : ''}
      </span>
      {token.lemma ? (
        <span style={{ fontSize: 10, color: '#3a3a3a' }}>
          <span style={{ opacity: 0.65 }}>lemma · </span>
          <span dir="rtl" lang="ar" style={{ fontFamily, fontWeight: 600 }}>
            {lemmaDisplay(token.lemma)}
          </span>
        </span>
      ) : null}
      {token.root ? (
        <span style={{ fontSize: 10, color: '#3a3a3a' }}>
          <span style={{ opacity: 0.65 }}>root · </span>
          <span dir="rtl" lang="ar" style={{ fontFamily, fontWeight: 600 }}>
            {rootBuckwalterToArabic(token.root)}
          </span>
          <span style={{ marginInlineStart: 6, color: '#b6862c', fontFamily: 'monospace' }}>
            {token.root}
          </span>
        </span>
      ) : null}
      {features.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 2,
          }}
        >
          {features.slice(0, 8).map(([k, v]) => (
            <span
              key={k}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 9,
                letterSpacing: 0.5,
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(27,77,90,0.15)',
                color: '#3a3a3a',
              }}
            >
              {featureChipLabel(k, v)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function pickArabicSize(
  format: 'landscape' | 'square' | 'story',
  chars: number,
  isWbw: boolean,
): number {
  if (isWbw) return format === 'story' ? 36 : 30;
  if (format === 'story') {
    if (chars > 400) return 44;
    if (chars > 200) return 56;
    return 70;
  }
  if (format === 'square') {
    if (chars > 400) return 36;
    if (chars > 200) return 46;
    return 58;
  }
  if (chars > 600) return 32;
  if (chars > 400) return 40;
  if (chars > 250) return 48;
  if (chars > 130) return 58;
  return 72;
}

function Pill({
  color,
  tone,
  children,
}: {
  readonly color: 'gold' | 'leaf';
  readonly tone: 'filled' | 'ghost' | 'ring';
  readonly children: ReactNode;
}): ReactNode {
  const colors =
    color === 'gold'
      ? { fg: '#b6862c', bg: 'rgba(182,134,44,0.10)', ring: 'rgba(182,134,44,0.35)' }
      : { fg: '#1b4d5a', bg: 'rgba(27,77,90,0.06)', ring: 'rgba(27,77,90,0.18)' };
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: 800,
    padding: '4px 11px',
    borderRadius: 999,
    color: colors.fg,
    background: tone === 'filled' || tone === 'ring' ? colors.bg : 'transparent',
    border: `1px solid ${tone === 'ghost' ? 'transparent' : colors.ring}`,
  };
  return <span style={style}>{children}</span>;
}
