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
 * Caching: the file path is stable, so the browser caches it after
 * the first load (Next.js serves /public/* with strong cache
 * headers). After the very first tajweed view, the parse cost
 * becomes trivial.
 */

const CSS_HREF = '/qpc-v4-fonts.css';
const LINK_ID = 'qalaam-tajweed-css';

let injected = false;

export function loadTajweedCss(): void {
  if (typeof document === 'undefined') return; // SSR guard
  if (injected) return;
  if (document.getElementById(LINK_ID)) {
    injected = true;
    return;
  }
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  document.head.appendChild(link);
  injected = true;
}
