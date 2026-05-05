/**
 * /about — what Qalaam is + data sources + license attribution.
 *
 * Editorial design: SiteNav + magazine-style colophon. Each data source
 * gets a hairline-bordered row with attribution, license tag in
 * smallcaps, and the upstream URL as a subtle link. Privacy posture
 * gets its own paper-card-raised callout with leaf accent.
 *
 * Per CC-BY-4.0 (quran-align, quran-tajweed) and MIT (QUL): visible
 * attribution required. This page is the canonical Settings → Data
 * Sources surface.
 */
import {
  BookGlyph,
  CrescentGlyph,
  HairlineDivider,
  LanternGlyph,
  RosetteGlyph,
} from '../../components/Glyph.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'About · Data sources · Qalaam',
};

interface DataSource {
  name: string;
  attribution: string;
  license: string;
  description: string;
  url?: string;
}

const SOURCES: readonly DataSource[] = [
  {
    name: 'Quranic Universal Library (QUL)',
    attribution: 'Tarteel AI',
    license: 'MIT (per-resource)',
    description:
      'Canonical Uthmani text, KFGQPC mushaf layouts, 14 reciters with word-level segments, mutashabihat clusters, similar-ayah pairs, surah info, word-by-word.',
    url: 'https://qul.tarteel.ai',
  },
  {
    name: 'quran-align',
    attribution: 'cpfair',
    license: 'CC-BY-4.0',
    description: 'Word-end audio timings for Tarteel ASR ground-truth alignment.',
    url: 'https://github.com/cpfair/quran-align',
  },
  {
    name: 'quran-tajweed',
    attribution: 'quran/quran-tajweed',
    license: 'CC-BY-4.0',
    description: 'Per-character tajweed-rule annotations across the full Quran.',
    url: 'https://github.com/quran/quran-tajweed',
  },
  {
    name: 'fawazahmed0/quran-api',
    attribution: 'fawazahmed0',
    license: 'Unlicense (public domain)',
    description: '440+ translations across 98 languages, lazy-mirrored at request time.',
    url: 'https://github.com/fawazahmed0/quran-api',
  },
  {
    name: 'everyayah.com',
    attribution: 'EveryAyah community',
    license: 'effectively public-domain',
    description:
      "Per-ayah recitation audio for 80+ qaris. Source-of-record for ad-hoc reciters Qalaam doesn't bundle.",
    url: 'https://everyayah.com',
  },
  {
    name: 'Quran.Foundation API',
    attribution: 'Quran.Foundation',
    license: 'bespoke ToS',
    description:
      'Live overlay for fresh data. Caches obey the upstream 7-day cap. Used as fallback only — QUL is canonical.',
    url: 'https://quran.foundation',
  },
];

export default function AboutPage(): ReactNode {
  return (
    <>
      <SiteNav />

      <header className="border-hairline border-b">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="flex items-center gap-3">
            <BookGlyph size={20} className="text-leaf" />
            <span className="smallcaps text-leaf text-xs">Colophon · About</span>
          </div>
          <h1 className="font-display text-ink-strong mt-4 text-5xl font-light tracking-tight md:text-6xl">
            A Quran companion
            <br />
            <span className="text-leaf italic">for the whole home.</span>
          </h1>
          <p className="text-ink-muted mt-6 max-w-2xl text-base leading-relaxed">
            Qalaam is a family-aware, smart-home-aware Quran and Hifdh platform. Read, listen, and
            memorize — across every speaker in your home. Adhan-aware. No ads, ever. Private by
            design.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="paper-card-raised reveal p-10 md:p-12">
          <div className="mb-4 flex items-center gap-3">
            <CrescentGlyph size={18} className="text-leaf" />
            <p className="smallcaps text-leaf text-xs">Privacy posture</p>
          </div>
          <h2 className="font-display text-ink-strong text-3xl">
            Audio never leaves the trust boundary.
          </h2>
          <HairlineDivider />
          <p className="text-ink max-w-prose text-base leading-relaxed">
            Mistake-detection ASR runs on your device. The cloud-sync schema architecturally rejects
            audio fields — there is no path for raw recitation audio to reach a Qalaam server. We
            never sell, profile, or biometrically fingerprint user audio.
          </p>
        </div>
      </section>

      <section className="border-hairline mx-auto max-w-4xl border-t px-6 py-12">
        <div className="mb-8 flex items-baseline gap-3">
          <LanternGlyph size={18} className="text-leaf" />
          <h2 className="font-display text-3xl font-light tracking-tight">Data sources</h2>
        </div>
        <p className="text-ink-muted max-w-prose text-base leading-relaxed">
          Qalaam is built on top of high-quality, openly-licensed Quranic data. Their attribution is
          below — required by their licenses, and offered gladly.
        </p>

        <ol className="paper-card divide-hairline mt-8 divide-y">
          {SOURCES.map((src) => (
            <li key={src.name} className="reveal grid grid-cols-12 gap-4 px-8 py-6">
              <span className="col-span-12 self-start md:col-span-1">
                <RosetteGlyph size={20} className="text-leaf" />
              </span>
              <div className="col-span-12 md:col-span-7">
                <h3 className="font-display text-ink-strong text-lg">{src.name}</h3>
                <p className="smallcaps text-ink-muted mt-1 text-xs">{src.attribution}</p>
                <p className="text-ink mt-3 text-sm leading-relaxed">{src.description}</p>
              </div>
              <div className="col-span-12 md:col-span-4 md:text-right">
                <p className="smallcaps text-leaf text-xs">{src.license}</p>
                {src.url ? (
                  <a
                    href={src.url}
                    rel="noreferrer"
                    target="_blank"
                    className="text-ink-muted hover:text-leaf mt-2 inline-block font-mono text-xs"
                  >
                    {src.url.replace(/^https?:\/\//, '')}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-hairline mx-auto max-w-4xl border-t px-6 py-12">
        <h2 className="font-display text-3xl font-light tracking-tight">Licenses</h2>
        <HairlineDivider />
        <p className="text-ink max-w-prose text-base leading-relaxed">
          Qalaam libraries are <span className="font-mono text-sm">Apache-2.0</span>; the SaaS apps
          and services are <span className="font-mono text-sm">AGPL-3.0</span>. Full third-party
          attributions live in <span className="font-mono text-sm">THIRD_PARTY_NOTICES.md</span>.
        </p>
      </section>
    </>
  );
}
