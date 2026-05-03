/**
 * /about — what Qalaam is + data sources + license attribution.
 *
 * Per CC-BY-4.0 (quran-align, quran-tajweed) and MIT (QUL): visible attribution
 * required. This page is the canonical "Settings → Data Sources" surface.
 */
import type { ReactNode } from 'react';

export const metadata = {
  title: 'About + Data Sources',
};

export default function AboutPage(): ReactNode {
  return (
    <div className="mx-auto max-w-3xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">About Qalaam</h1>
        <p className="mt-2 opacity-80">
          A family-aware, smart-home-aware Quran and Hifdh platform. Read,
          listen, and memorize — across every speaker in your home. Built for
          families. Respects your prayer times. No ads, ever.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Data sources</h2>
        <p className="mt-2 text-sm opacity-80">
          Qalaam is built on top of high-quality, openly-licensed Quranic data.
          Their attribution is below — required by their licenses and offered
          gladly.
        </p>
        <ul className="mt-4 list-disc pl-5 text-sm">
          <li>
            <strong>Quranic Universal Library (QUL)</strong> — TarteelAI · MIT
            license · canonical Arabic text, mushaf layouts, audio segments,
            mutashabihat clusters.
          </li>
          <li>
            <strong>quran-align</strong> — cpfair · CC-BY-4.0 · word-end audio
            timings.
          </li>
          <li>
            <strong>quran-tajweed</strong> — quran/quran-tajweed · CC-BY-4.0 ·
            per-character tajweed-rule annotations.
          </li>
          <li>
            <strong>fawazahmed0/quran-api</strong> — Unlicense (public domain) ·
            440+ translations across 98 languages, lazy-mirrored.
          </li>
          <li>
            <strong>everyayah.com</strong> — effectively public-domain · per-ayah
            recitation audio for 80+ qaris.
          </li>
          <li>
            <strong>Quran.Foundation API</strong> — bespoke ToS · live overlay for
            fresh data; cached ≤ 7 days per their terms.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Privacy posture</h2>
        <p className="mt-2 text-sm opacity-80">
          Qalaam runs ASR (mistake detection) <strong>on your device</strong> —
          audio never leaves the trust boundary. The cloud-sync transport schema
          architecturally rejects audio fields. We never sell, profile, or
          biometrically fingerprint user audio. See ADR-0005 + ADR-0016.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">License</h2>
        <p className="mt-2 text-sm opacity-80">
          Qalaam libraries are Apache-2.0; the SaaS apps and services are
          AGPL-3.0. See <code>LICENSE</code> + <code>THIRD_PARTY_NOTICES.md</code>.
        </p>
      </section>
    </div>
  );
}
