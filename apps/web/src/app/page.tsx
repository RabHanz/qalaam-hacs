/**
 * Landing — the first 60 seconds.
 *
 * Design intent (per `reference_competitive_ux.md`): editorial scripture.
 * NOT another emerald-and-XP Quranly clone, NOT another Tarteel-clinical-
 * dashboard. The page reads like the title spread of a hand-bound mushaf:
 *
 *   - Arabic title "قَلَم" set in display size as the visual anchor
 *   - Asymmetric grid: hero in left column, vertical Bismillah strip + a
 *     "first verse" preview on the right
 *   - Editorial nav at top with custom geometric glyphs
 *   - Three feature cards (Read / Listen / Hifdh) below the fold,
 *     deliberately spare — small caps section labels, not jumbo CTAs
 *   - Surah picker as a long, restrained list — like a table of contents,
 *     not a card grid
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { BookGlyph, CrescentGlyph, HairlineDivider, ThreadGlyph } from '../components/Glyph.js';
import { SiteNav } from '../components/SiteNav.js';

interface Surah {
  surah: number;
  nameArabic: string;
  nameEnglish: string;
  verseCount: number;
  revelationPlace: 'makkah' | 'madinah';
}

async function fetchSurahs(baseUrl: string): Promise<readonly Surah[]> {
  try {
    const res = await fetch(`${baseUrl}/v1/metadata/surahs`, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: Surah[] };
    return body.data;
  } catch {
    return [];
  }
}

export default async function HomePage(): Promise<ReactNode> {
  const baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  const surahs = await fetchSurahs(baseUrl);

  return (
    <>
      <SiteNav />

      {/* HERO — asymmetric editorial spread */}
      <section className="border-b border-hairline">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-12 md:py-28">
          <div className="md:col-span-7 lg:col-span-7 reveal">
            <p className="smallcaps text-leaf text-xs mb-6">
              Editio · Familiae · Domi
            </p>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-light leading-[1.05] tracking-tight">
              A Quran companion
              <br />
              <span className="italic text-leaf">for the whole home.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-muted">
              Read, listen, and memorize — across every speaker in your house.
              Built for families. Respects your prayer times. Family-private,
              never gamified.
              <span className="block mt-2 text-base">No ads. No XP. No leaderboards.</span>
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/read/1"
                className="group inline-flex items-center gap-2 rounded-sm bg-ink px-7 py-3.5 text-white transition-colors hover:bg-ink-strong"
              >
                <span className="font-medium">Begin with Al-Fātiḥa</span>
                <span aria-hidden className="text-leaf-soft transition-transform group-hover:translate-x-0.5 rtl-flip">→</span>
              </Link>
              <Link
                href="/about"
                className="text-sm smallcaps text-ink-muted hover:text-ink underline-offset-4 hover:underline"
              >
                What is Qalaam
              </Link>
            </div>
          </div>

          {/* Right column — vertical Bismillah strip with surah preview */}
          <aside className="md:col-span-5 lg:col-span-5 reveal reveal-2">
            <div className="paper-card-raised relative overflow-hidden p-8 md:p-10">
              {/* corner ornament */}
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30"
                style={{ background: 'radial-gradient(circle, var(--color-leaf-300) 0%, transparent 70%)' }}
                aria-hidden
              />
              <div className="relative">
                <p className="smallcaps text-leaf text-xs">Sūrat al-Fātiḥa · 1:1</p>
                <p
                  dir="rtl"
                  className="font-arabic mt-6 text-4xl md:text-5xl leading-[2] text-ink-strong"
                  style={{ unicodeBidi: 'plaintext' }}
                >
                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                </p>
                <p className="font-display mt-4 text-base italic text-ink-muted leading-relaxed">
                  In the name of God,
                  <br />the Most Gracious, the Most Merciful.
                </p>
                <HairlineDivider />
                <p className="text-sm text-ink-muted">
                  6,236 verses · 114 surahs · word-by-word in 16 languages · audio in 62 reciters
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* FEATURE STRIP — three sparse columns */}
      <section className="border-b border-hairline">
        <div className="mx-auto grid max-w-6xl gap-px bg-paper-200/60 px-6 py-0 md:grid-cols-3 md:px-0">
          <FeatureCell
            icon={BookGlyph}
            title="Read"
            arabic="قِرَاءَة"
            body="Page-faithful in Madani · Indopak · KFGQPC. Tap any word for word-by-word translation, root, and tajweed cues."
            href="/read/1"
            delay={1}
          />
          <FeatureCell
            icon={CrescentGlyph}
            title="Listen"
            arabic="إِسْتِمَاع"
            body="Ambient passive playback of your sabaq · sabqi across every speaker in the house. Adhan-aware. Never interrupts prayer."
            href="/listen"
            delay={2}
          />
          <FeatureCell
            icon={ThreadGlyph}
            title="Hifdh"
            arabic="حِفْظ"
            body="FSRS-6 spaced repetition. Mutashabihat-aware review. Streaks with grace days, never punishing. Family-private summaries."
            href="/hifdh"
            delay={3}
          />
        </div>
      </section>

      {/* TABLE OF CONTENTS — surahs list, not card grid */}
      <section className="border-b border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-baseline gap-6 md:grid-cols-12 mb-12">
            <div className="md:col-span-4">
              <p className="smallcaps text-leaf text-xs">Index · فِهْرِس</p>
              <h2 className="font-display mt-3 text-4xl font-light tracking-tight">
                The 114 surahs
              </h2>
            </div>
            <p className="md:col-span-8 text-base text-ink-muted leading-relaxed">
              All 6,236 verses ingested from the Quranic Universal Library
              (Tarteel AI). Tap any surah to read in full, or jump to deep
              study for a single verse with translations, tafsir, word-by-word,
              and mutashabihat watchlist.
            </p>
          </div>

          {surahs.length === 0 ? (
            <p className="paper-card p-8 text-center text-sm text-ink-muted">
              Backend unreachable. Start the dev backend on :4111 and refresh.
            </p>
          ) : (
            <ul className="grid gap-px bg-paper-200/50 sm:grid-cols-2 md:grid-cols-3">
              {surahs.map((s) => (
                <li key={s.surah}>
                  <Link
                    href={`/read/${s.surah.toString()}`}
                    className="group flex items-baseline justify-between gap-4 bg-paper px-5 py-4 transition-colors hover:bg-paper-100"
                  >
                    <div className="flex items-baseline gap-4 min-w-0">
                      <span className="smallcaps font-mono text-xs text-ink-muted tabular-nums w-6 shrink-0">
                        {s.surah.toString().padStart(3, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-lg leading-tight text-ink truncate group-hover:text-leaf transition-colors">
                          {s.nameEnglish}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {s.verseCount.toString()} verses · {s.revelationPlace}
                        </p>
                      </div>
                    </div>
                    <span
                      dir="rtl"
                      className="font-arabic text-2xl text-ink-strong shrink-0"
                      style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
                    >
                      {s.nameArabic}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-12">
        <div className="rule-hairline" />
        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3 text-xs text-ink-muted">
          <p>
            Quranic text via{' '}
            <a
              href="https://qul.tarteel.ai"
              className="text-leaf hover:underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              Quranic Universal Library
            </a>{' '}
            · Tarteel AI · MIT
          </p>
          <p className="smallcaps">v0 · qalaam</p>
        </div>
      </footer>
    </>
  );
}

interface FeatureCellProps {
  readonly icon: React.ComponentType<{ size?: number; className?: string }>;
  readonly title: string;
  readonly arabic: string;
  readonly body: string;
  readonly href: string;
  readonly delay: 1 | 2 | 3 | 4 | 5;
}

function FeatureCell({ icon: Icon, title, arabic, body, href, delay }: FeatureCellProps): ReactNode {
  return (
    <Link
      href={href}
      className={`group bg-paper p-8 md:p-10 transition-colors hover:bg-paper-100 reveal reveal-${delay.toString()}`}
    >
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <Icon size={26} className="text-ink-muted group-hover:text-leaf transition-colors" />
        <span
          dir="rtl"
          className="font-arabic text-xl text-ink-muted group-hover:text-leaf transition-colors"
          style={{ unicodeBidi: 'plaintext', lineHeight: 1 }}
        >
          {arabic}
        </span>
      </div>
      <h3 className="font-display text-3xl font-light tracking-tight mb-3 text-ink group-hover:text-ink-strong">
        {title}
      </h3>
      <p className="text-base text-ink-muted leading-relaxed">{body}</p>
      <span aria-hidden className="mt-6 inline-flex items-center gap-2 text-sm smallcaps text-ink-muted group-hover:text-leaf transition-colors">
        Open <span className="rtl-flip">→</span>
      </span>
    </Link>
  );
}
