/**
 * Root layout. RTL-aware via `dir` attribute (set on the relevant subtree).
 *
 * Per CLAUDE.md design non-negotiables:
 *  - Mobile-first responsive
 *  - Reduced-motion-aware (handled in tokens.css)
 *  - Dynamic type: rem-based throughout
 *  - Accessibility: skip-link, lang attribute
 */
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '../styles/globals.css';

import { DEFAULT_LOCALE, dirOf } from '../lib/i18n.js';

export const metadata: Metadata = {
  title: {
    default: 'Qalaam — Quran & Hifdh, at home',
    template: '%s | Qalaam',
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

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <html lang={DEFAULT_LOCALE} dir={dirOf(DEFAULT_LOCALE)}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-[var(--color-teal-500)] focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
