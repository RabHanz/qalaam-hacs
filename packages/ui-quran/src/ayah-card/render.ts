/**
 * SVG ayah card generator.
 *
 * Used for sharing — server-side render to SVG/PNG via Satori + resvg in
 * `apps/backend`. This module produces the SVG markup; rasterization is the
 * caller's job (so the browser can also use it directly as inline SVG).
 *
 * Per strategy §11.5: 4-5 templates, square + story aspect ratios, branded
 * watermark. v0.1 ships ONE template ("Calm cream"); future templates plug in.
 */

export interface AyahCardOptions {
  readonly arabic: string;
  readonly translation?: string;
  readonly verseKey: string;
  readonly aspect?: 'square' | 'story';
  readonly template?: 'calm-cream';
  readonly watermark?: string;
}

const SQUARE = { width: 1080, height: 1080 };
const STORY = { width: 1080, height: 1920 };

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE[c] ?? c);
}

export function renderAyahCardSvg(opts: AyahCardOptions): string {
  const { arabic, translation, verseKey } = opts;
  const dims = opts.aspect === 'story' ? STORY : SQUARE;
  const watermark = opts.watermark ?? 'qalaam.app';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(dims.width)}" height="${String(dims.height)}" viewBox="0 0 ${String(dims.width)} ${String(dims.height)}">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#fbf9f4"/>
      <stop offset="100%" stop-color="#f7f4ee"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <text x="${String(dims.width / 2)}" y="${String(dims.height * 0.45)}" text-anchor="middle" font-family="'KFGQPC HAFS Uthmanic Script V2', 'Amiri Quran', serif" font-size="80" fill="#103840" direction="rtl">${esc(arabic)}</text>
  ${translation ? `<text x="${String(dims.width / 2)}" y="${String(dims.height * 0.6)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="36" fill="#1b4d5a" opacity="0.85">${esc(translation)}</text>` : ''}
  <text x="${String(dims.width / 2)}" y="${String(dims.height * 0.7)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="28" fill="#b6862c">— ${esc(verseKey)} —</text>
  <text x="${String(dims.width / 2)}" y="${String(dims.height - 40)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="20" fill="#103840" opacity="0.6">${esc(watermark)}</text>
</svg>`;
}
