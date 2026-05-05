/**
 * Root layout. RTL-aware via `dir` attribute (set on the relevant subtree).
 *
 * Per CLAUDE.md design non-negotiables:
 *  - Mobile-first responsive
 *  - Reduced-motion-aware (handled in globals.css)
 *  - Dynamic type: rem-based throughout
 *  - Accessibility: skip-link, lang attribute
 *  - Editorial type pairing: Fraunces + IBM Plex Sans + KFGQPC HAFS
 */
import '../styles/globals.css';

import { DEFAULT_LOCALE, dirOf } from '../lib/i18n.js';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'Qalaam — Quran & Hifdh, at home',
    template: '%s · Qalaam',
  },
  description:
    'A family-aware, smart-home-aware Quran and Hifdh platform. Read, listen, memorize — across every speaker in your home.',
  applicationName: 'Qalaam',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1b4d5a' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1416' },
  ],
};

/**
 * Inline script that runs before first paint. Reads the persisted theme
 * choice from localStorage and sets `data-theme` on <html> so the
 * correct palette is applied without FOUC. Per the ThemeToggle, choices
 * are 'light' | 'system' | 'dark'.
 */
const themeBootstrap = `
(function () {
  try {
    var v = localStorage.getItem('qalaam-theme');
    if (v === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (v === 'system') {
      var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang={DEFAULT_LOCALE} dir={dirOf(DEFAULT_LOCALE)} suppressHydrationWarning>
      <head>
        {/*
         * Google Fonts loaded via <link> in <head>, NOT via @import in
         * globals.css. Why: Tailwind v4's PostCSS pipeline expands its
         * utility CSS at the top of the bundle, pushing any @import in
         * globals.css past byte position 64K — past the first non-
         * import rule. Per the CSS spec, @import after any rule is
         * silently ignored, so Nastaliq/Scheherazade/Naskh/Fraunces/
         * IBM Plex Sans were never loading. Putting the request in
         * <head> sidesteps the issue entirely.
         *
         * preconnect + dns-prefetch shave ~100ms off the first paint
         * by setting up the TCP+TLS handshake before the stylesheet
         * actually fires its sub-requests for the .woff2 files.
         */}
        {/*
         * Quran fonts are 100% self-hosted with full glyph coverage:
         *   - UthmanicHafs   /fonts/quran/UthmanicHafs1Ver18.woff2
         *     (Madani / Tajweed layouts)
         *   - AlQuranIndoPak /fonts/quran-indopak/AlQuranIndoPak-Regular.ttf
         *     (IndoPak layouts)
         * Both preloaded so they're in cache by first paint. `font-
         * display: block` (set in @font-face) holds rendering up to 3s
         * waiting for the font — but with preload firing in parallel
         * with HTML parse, the wait is unobservable. No CDN, no FOUT,
         * no font-flicker the user complained about.
         */}
        <link
          rel="preload"
          href="/fonts/quran/UthmanicHafs1Ver18.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/quran-indopak/IndopakNastaleeqHanafi-v422.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        {/*
         * Latin display + body fonts (Fraunces, IBM Plex Sans). These
         * stay on Google Fonts CDN — they don't render Quranic text
         * so any FOUT here is invisible (Latin metrics are close
         * enough that the swap is imperceptible). Dropped Arabic
         * Google Fonts entries (Amiri, Amiri Quran, Noto Naskh
         * Arabic, Scheherazade New, Noto Nastaliq Urdu) — fully
         * superseded by the two self-hosted Arabic fonts above.
         */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className="bg-paper text-ink paper-texture min-h-screen antialiased"
        suppressHydrationWarning
      >
        <a
          href="#main"
          className="focus:bg-ink sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        <main id="main" className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
