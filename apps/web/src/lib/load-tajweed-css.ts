/**
 * Lazy loader for the 604-page KFGQPC V4 tajweed CSS bundle (~484KB).
 *
 * Why this exists: parsing 604 @font-face declarations + 1,208
 * @font-palette-values declarations on EVERY route was producing
 * visible page sluggishness and (on slower devices) Chrome
 * STATUS_BREAKPOINT renderer crashes. Most of our routes never
 * touch tajweed mode, so paying that parse cost globally is pure
 * overhead.
 *
 * The CSS lives at /qpc-v4-fonts.css (a static asset under public/)
 * and we inject a <link rel="stylesheet"> the first time a tajweed-
 * rendering surface (AyahCard with V4, MushafLines with tajweed
 * layout, ShareCardSurface, etc.) mounts. The link tag is shared
 * across mounts via a module-scoped flag — repeat calls are no-ops.
 *
 * `loadTajweedCss()` returns a Promise that resolves once the
 * stylesheet has loaded — callers gate V4 PUA rendering on this so
 * we don't paint U+FC41-U+FC64 codepoints with the wrong fallback
 * font (which produces visible gibberish until the per-page COLR
 * font lands a moment later).
 *
 * `isQpcV4FontReady(family)` returns whether a specific page font
 * has finished loading — needed because the @font-face declarations
 * are gated by `unicode-range`, so the font only fetches when the
 * browser actually paints PUA glyphs.
 *
 * Caching: the file path is stable, so the browser caches it after
 * the first load (Next.js serves /public/* with strong cache
 * headers). After the very first tajweed view, the parse cost
 * becomes trivial.
 */

const CSS_HREF = '/qpc-v4-fonts.css';
const LINK_ID = 'qalaam-tajweed-css';

let cssReady: Promise<void> | null = null;

export function loadTajweedCss(): Promise<void> {
  if (cssReady) return cssReady;
  if (typeof document === 'undefined') {
    return Promise.resolve(); // SSR — caller's effect re-runs on hydrate
  }
  const existing = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (existing) {
    cssReady =
      existing.sheet !== null
        ? Promise.resolve()
        : new Promise((resolve) => {
            existing.addEventListener('load', () => {
              resolve();
            });
            existing.addEventListener('error', () => {
              resolve();
            });
          });
    return cssReady;
  }
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  cssReady = new Promise((resolve) => {
    link.addEventListener('load', () => {
      resolve();
    });
    link.addEventListener('error', () => {
      // Resolve on error too — the V4 path will fall through to the
      // CSS-overlay tajweed render since fontFamily lookup will miss.
      resolve();
    });
  });
  document.head.appendChild(link);
  return cssReady;
}

/**
 * Force-load a specific QPCv4Page<N> font (declared in qpc-v4-fonts.css)
 * and resolve once the browser confirms its glyphs are available.
 *
 * @font-face declarations gate by `unicode-range: U+FC41-U+FC64`, so the
 * actual woff2 fetch only kicks off when the renderer needs to paint
 * those codepoints. Calling document.fonts.load(...) ahead of the paint
 * forces the fetch deterministically — once it resolves, we know the
 * COLR font is ready and the PUA spans we render won't briefly fall
 * back to the system Arabic font (which produces visible gibberish
 * since U+FC41-FC64 is a real Unicode block of isolated Arabic forms).
 */
export async function ensureQpcV4Font(fontFamily: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  await loadTajweedCss();
  // FontFaceSet.load() needs the font specifier in `<size> <family>`
  // form. Pull a representative PUA codepoint into the third arg so
  // the unicode-range gate triggers the actual fetch.
  const docFonts = document.fonts as FontFaceSet | undefined;
  if (!docFonts) return false;
  try {
    await docFonts.load(`1em "${fontFamily}"`, 'ﱁ');
    return docFonts.check(`1em "${fontFamily}"`, 'ﱁ');
  } catch {
    return false;
  }
}
