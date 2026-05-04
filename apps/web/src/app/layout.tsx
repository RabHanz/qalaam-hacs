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
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '../styles/globals.css';

import { DEFAULT_LOCALE, dirOf } from '../lib/i18n.js';

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

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <html lang={DEFAULT_LOCALE} dir={dirOf(DEFAULT_LOCALE)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen bg-paper text-ink antialiased paper-texture">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-white"
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
