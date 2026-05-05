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
  readonly format: 'landscape' | 'square' | 'story';
  readonly variant: 'minimal' | 'translation' | 'wbw' | 'advanced';
  readonly layoutSlug: string;
  readonly showTransliteration: boolean;
  readonly showGrammar: boolean;
  readonly showTafsir: boolean;
}

const POS_LABEL: Record<string, string> = {
  N: 'Noun',
  PN: 'Proper noun',
  ADJ: 'Adjective',
  V: 'Verb',
  P: 'Preposition',
  CONJ: 'Conjunction',
  SUB: 'Subordinator',
  REM: 'Resumption',
  PRON: 'Pronoun',
  REL: 'Relative',
  DEM: 'Demonstrative',
  DET: 'Determiner',
  NEG: 'Negation',
  EMPH: 'Emphatic',
  VOC: 'Vocative',
};

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
    format,
    variant,
    layoutSlug,
    showTransliteration,
    showGrammar,
    showTafsir,
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
  const dims = (() => {
    if (format === 'square') return { width: 1080, minHeight: 1080 };
    if (format === 'story') return { width: 1080, minHeight: 1920 };
    return { width: 1200, minHeight: 630 };
  })();

  return (
    <main
      className="share-card paper-texture"
      data-share-card="1"
      style={{
        width: dims.width,
        minHeight: dims.minHeight,
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
          minHeight: dims.minHeight,
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
                  {variant.toUpperCase()}
                </Pill>
              ) : null}
              {layoutSlug ? (
                <Pill color="leaf" tone="ghost">
                  {layoutSlug.replace(/_/g, ' ')}
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

          {/* Arabic + WBW + insights */}
          <section
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              marginTop: 26,
            }}
          >
            {variant === 'wbw' && wbw && wbw.length > 0 ? (
              <WbwGrid
                wbw={wbw}
                fontFamily={fontFamily}
                arabicSize={pickArabicSize(format, arabic.length, true)}
              />
            ) : (
              <ArabicVerse
                arabic={arabic}
                fontFamily={fontFamily}
                fontSize={pickArabicSize(format, arabic.length, false)}
                tajweedActive={isTajweed}
              />
            )}
            {showTransliteration && transliteration ? (
              <Transliteration text={transliteration} format={format} />
            ) : null}
            {variant !== 'minimal' && variant !== 'wbw' && translation ? (
              <Translation text={translation} format={format} />
            ) : null}
            {showGrammar && morphology ? (
              <GrammarStrip morphology={morphology} fontFamily={fontFamily} />
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
  tajweedActive,
}: {
  readonly arabic: string;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly tajweedActive: boolean;
}): ReactNode {
  // Tajweed annotations would be a fetch — for static screenshot we
  // skip color in the absence of annotations data passed through.
  // (Annotation fetch is wired in /share-card/page.tsx if needed.)
  void tajweedActive;
  return (
    <p
      dir="rtl"
      lang="ar"
      style={{
        fontFamily,
        fontSize,
        lineHeight: 1.95,
        color: '#0e0e0e',
        fontWeight: 600,
        unicodeBidi: 'plaintext',
        textAlign: 'right',
        margin: 0,
        wordBreak: 'normal',
      }}
    >
      {arabic}
    </p>
  );
}

// Reserved for the per-word tajweed branch — silence unused-export warns
void applyTajweed;
type _ReservedTajweedType = TajweedAnnotation;
const _reservedTajweed: _ReservedTajweedType[] = [];
void _reservedTajweed;

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
}: {
  readonly text: string;
  readonly format: 'landscape' | 'square' | 'story';
}): ReactNode {
  return (
    <p
      dir="ltr"
      lang="en"
      style={{
        fontSize: format === 'story' ? 22 : 18,
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
}: {
  readonly text: string;
  readonly format: 'landscape' | 'square' | 'story';
}): ReactNode {
  return (
    <p
      dir="ltr"
      lang="en"
      style={{
        fontSize: format === 'story' ? 26 : 22,
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

function GrammarStrip({
  morphology,
  fontFamily,
}: {
  readonly morphology: readonly MorphologyWord[];
  readonly fontFamily: string;
}): ReactNode {
  // Per-word grammar mini-card row, RTL flow. Each card shows the
  // word's stem token's POS + lemma + root.
  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        unicodeBidi: 'plaintext',
        margin: 0,
        padding: '12px 14px',
        background: 'rgba(27,77,90,0.05)',
        borderRadius: 10,
      }}
    >
      {morphology.map((w) => {
        const stem = w.tokens.find((t) => t.isStem) ?? w.tokens[0];
        if (!stem) return null;
        return (
          <div
            key={w.wordIndex}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 10px',
              minWidth: 80,
              background: '#fff',
              border: '1px solid rgba(27,77,90,0.18)',
              borderRadius: 8,
              gap: 4,
            }}
          >
            <span
              dir="rtl"
              lang="ar"
              style={{
                fontFamily,
                fontSize: 22,
                color: '#0e0e0e',
                fontWeight: 600,
                lineHeight: 1.2,
                unicodeBidi: 'plaintext',
              }}
            >
              {stem.form}
            </span>
            <span
              style={{
                fontSize: 9,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: '#1b4d5a',
                fontWeight: 700,
              }}
            >
              {POS_LABEL[stem.tag] ?? stem.tag}
            </span>
            {stem.root ? (
              <span
                style={{
                  fontSize: 10,
                  color: '#b6862c',
                  fontFamily: 'monospace',
                }}
              >
                √ {stem.root}
              </span>
            ) : null}
          </div>
        );
      })}
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
