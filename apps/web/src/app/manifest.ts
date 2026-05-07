/**
 * PWA manifest. Renders to `/manifest.webmanifest` at request time
 * via Next.js's app/manifest convention. Linked into the document
 * head automatically.
 *
 * Adab: Qalaam is a Quran companion. The manifest's name + short_name
 * preserve that register; the description echoes the marketing
 * landing rather than something dashboard-y.
 *
 * `display: 'standalone'` so the installed app gets its own window
 * without browser chrome — important for the "I want this on my home
 * screen" use case (the Hifdh app, the airport listen-mode session).
 */
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Qalaam — Quran & Hifdh, at home',
    short_name: 'Qalaam',
    description:
      'A family-aware Quran and Hifdh companion. Read, listen, memorize — across every speaker in your home.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f1e8',
    theme_color: '#1b4d5a',
    lang: 'en',
    dir: 'ltr',
    categories: ['education', 'books', 'lifestyle'],
    icons: [
      { src: '/icon1', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon3', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
