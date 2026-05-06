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
import { cookies } from 'next/headers';
import Link from 'next/link';

import {
  BookGlyph,
  CrescentGlyph,
  HairlineDivider,
  LanternGlyph,
  ThreadGlyph,
} from '../components/Glyph.js';
import { HijriNudge } from '../components/HijriNudge.js';
import { SiteNav } from '../components/SiteNav.js';
import { TodaySurface } from '../components/today/TodaySurface.js';

import type { ReactNode } from 'react';

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

interface AuthMe {
  id: string;
  email: string;
  displayName: string | null;
  tier: string;
}

async function fetchAuthMe(baseUrl: string, cookieHeader: string): Promise<AuthMe | null> {
  if (!cookieHeader) return null;
  try {
    const res = await fetch(`${baseUrl}/v1/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { user: AuthMe | null };
    return body.user;
  } catch {
    return null;
  }
}

// Always render per-request — the backend is on the Docker network at
// http://qalaam-backend:4111 and ISN'T running during `next build`,
// so static generation would bake empty/null data. Per-request
// rendering hits the live backend each time.
export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<ReactNode> {
  const baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  const cookieHeader = (await cookies()).toString();
  const [surahs, me] = await Promise.all([
    fetchSurahs(baseUrl),
    fetchAuthMe(baseUrl, cookieHeader),
  ]);

  // Authenticated visitors get the editorial "Today" surface up top —
  // verse of the day, next prayer, continue-where-you-left-off, hifdh
  // queue. The hero / index sections still render below for navigation.
  if (me) {
    return (
      <>
        <SiteNav />
        <TodaySurface
          displayName={me.displayName ?? me.email.split('@')[0] ?? null}
          apiBase={baseUrl}
          surahs={surahs}
        />
        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <HijriNudge />
        </section>
        <SurahIndex surahs={surahs} />
        <HomeFooter />
      </>
    );
  }

  return (
    <>
      <SiteNav />

      {/* HERO — asymmetric editorial spread, mobile-first */}
      <section className="border-hairline border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-20 md:grid-cols-12 md:gap-12 md:py-28">
          <div className="reveal md:col-span-7">
            <p className="smallcaps text-leaf mb-4 text-[11px] tracking-widest sm:mb-6">
              Editio · Familiae · Domi
            </p>
            <h1 className="font-display text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              A Quran companion
              <br />
              <span className="text-leaf italic">for the whole home.</span>
            </h1>
            <p className="text-ink-muted mt-6 max-w-xl text-base leading-relaxed sm:mt-8 sm:text-lg">
              Read, listen, and memorize — across every speaker in your house. Built for families.
              Adhan-aware. Family-private, never gamified.
              <span className="mt-2 block text-sm sm:text-base">
                No ads. No XP. No leaderboards.
              </span>
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4 sm:mt-10">
              <Link
                href="/read/1"
                className="bg-ink hover:bg-ink-strong group inline-flex items-center gap-2 rounded-sm px-6 py-3 text-white transition-colors sm:px-7 sm:py-3.5"
              >
                <span className="text-sm font-medium sm:text-base">Begin with Al-Fātiḥa</span>
                <span
                  aria-hidden
                  className="text-leaf-soft rtl-flip transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
              <Link
                href="/about"
                className="smallcaps text-ink-muted hover:text-ink text-xs underline-offset-4 hover:underline sm:text-sm"
              >
                What is Qalaam
              </Link>
            </div>
          </div>

          {/* Right column — vertical Bismillah strip with surah preview */}
          <aside className="reveal reveal-2 md:col-span-5">
            <div className="paper-card-raised relative overflow-hidden p-6 sm:p-8 md:p-10">
              <div
                className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30"
                style={{
                  background: 'radial-gradient(circle, var(--color-leaf-300) 0%, transparent 70%)',
                }}
                aria-hidden
              />
              <div className="relative">
                <p className="smallcaps text-leaf text-[11px] tracking-widest">
                  Sūrat al-Fātiḥa · 1:1
                </p>
                <p
                  dir="rtl"
                  className="font-arabic text-ink-strong mt-5 text-3xl leading-[2] sm:mt-6 sm:text-4xl md:text-5xl"
                  style={{ unicodeBidi: 'plaintext', fontWeight: 600 }}
                >
                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                </p>
                <p className="font-display text-ink-muted mt-3 text-sm italic leading-relaxed sm:mt-4 sm:text-base">
                  In the name of God,
                  <br />
                  the Most Gracious, the Most Merciful.
                </p>
                <HairlineDivider />
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="smallcaps text-ink-muted">Verses</dt>
                    <dd className="font-display text-ink-strong text-lg tabular-nums">6,236</dd>
                  </div>
                  <div>
                    <dt className="smallcaps text-ink-muted">Reciters</dt>
                    <dd className="font-display text-ink-strong text-lg tabular-nums">14</dd>
                  </div>
                  <div>
                    <dt className="smallcaps text-ink-muted">Translations</dt>
                    <dd className="font-display text-ink-strong text-lg tabular-nums">2 · en</dd>
                  </div>
                  <div>
                    <dt className="smallcaps text-ink-muted">Mushafs</dt>
                    <dd className="font-display text-ink-strong text-lg tabular-nums">3</dd>
                  </div>
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Calendar-aware contextual nudge — Surah Kahf on Friday,
          Ramadan-aware framing, Hijri events. Hidden if no nudge applies. */}
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <HijriNudge />
      </section>

      {/* FOUR-PILLAR FEATURE STRIP — mobile-first 1col → 2col → 4col */}
      <section className="border-hairline border-b">
        <div className="bg-paper-200/60 mx-auto grid max-w-6xl grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCell
            icon={BookGlyph}
            title="It reads with you"
            arabic="قِرَاءَة"
            body="Ayah-by-ayah cards · 14 reciters · Pickthall + Saheeh translations · word-by-word on tap · bookmarks · share."
            href="/read/1"
            delay={1}
          />
          <FeatureCell
            icon={CrescentGlyph}
            title="It listens around the house"
            arabic="إِسْتِمَاع"
            body="Ambient Listen Mode of your current sabaq · adhan-aware · Cast · Sonos · AirPlay · MQTT · Home Assistant native."
            href="/listen"
            delay={2}
          />
          <FeatureCell
            icon={ThreadGlyph}
            title="It helps your family memorize"
            arabic="حِفْظ"
            body="FSRS-6 spacing · sabaq · sabqi · manzil · mutashabihat-aware · grace-day streaks · daily summary, never surveillance."
            href="/hifdh"
            delay={3}
          />
          <FeatureCell
            icon={LanternGlyph}
            title="It plays with your home"
            arabic="بَيْت"
            body="Adhan-aware automations · door-LED indicators · family wall display · sleep / wake routines · Ramadan mode."
            href="/about"
            delay={4}
          />
        </div>
      </section>

      {/* TABLE OF CONTENTS — surahs list, not card grid */}
      <section className="border-hairline border-b">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
          <div className="mb-8 grid items-baseline gap-6 sm:mb-12 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="smallcaps text-leaf text-[11px] tracking-widest">Index · فِهْرِس</p>
              <h2 className="font-display mt-3 text-3xl font-light tracking-tight sm:text-4xl">
                The 114 surahs
              </h2>
            </div>
            <p className="text-ink-muted text-sm leading-relaxed sm:text-base md:col-span-8">
              All 6,236 verses ingested from the Quranic Universal Library (Tarteel AI). Tap any
              surah to read in full, or jump to deep study for a single verse with translations,
              tafsir, word-by-word, and mutashabihat watchlist.
            </p>
          </div>

          {surahs.length === 0 ? (
            <p className="paper-card text-ink-muted p-8 text-center text-sm">
              Backend unreachable. Start the dev backend on :4111 and refresh.
            </p>
          ) : (
            <ul className="bg-paper-200/50 grid gap-px sm:grid-cols-2 md:grid-cols-3">
              {surahs.map((s) => (
                <li key={s.surah}>
                  <Link
                    href={`/read/${s.surah.toString()}`}
                    className="bg-paper hover:bg-paper-100 group flex items-baseline justify-between gap-4 px-5 py-4 transition-colors"
                  >
                    <div className="flex min-w-0 items-baseline gap-4">
                      <span className="smallcaps text-ink-muted w-6 shrink-0 font-mono text-xs tabular-nums">
                        {s.surah.toString().padStart(3, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-ink group-hover:text-leaf truncate text-lg leading-tight transition-colors">
                          {s.nameEnglish}
                        </p>
                        <p className="text-ink-muted text-xs">
                          {s.verseCount.toString()} verses · {s.revelationPlace}
                        </p>
                      </div>
                    </div>
                    <span
                      dir="rtl"
                      className="font-arabic text-ink-strong shrink-0 text-2xl"
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
        <div className="text-ink-muted mt-6 flex flex-wrap items-baseline justify-between gap-3 text-xs">
          <p>
            Quranic text via{' '}
            <a
              href="https://qul.tarteel.ai"
              className="text-leaf underline-offset-4 hover:underline"
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

function SurahIndex({ surahs }: { surahs: readonly Surah[] }): ReactNode {
  return (
    <section className="border-hairline border-b">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="mb-8 grid items-baseline gap-6 sm:mb-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="smallcaps text-leaf text-[11px] tracking-widest">Index · فِهْرِس</p>
            <h2 className="font-display mt-3 text-3xl font-light tracking-tight sm:text-4xl">
              The 114 surahs
            </h2>
          </div>
          <p className="text-ink-muted text-sm leading-relaxed sm:text-base md:col-span-8">
            All 6,236 verses, sourced from the Quranic Universal Library. Tap any surah to read in
            full, or jump to deep study for a single verse with translations, tafsir, word-by-word,
            and the mutashabihat watchlist.
          </p>
        </div>
        {surahs.length === 0 ? (
          <p className="paper-card text-ink-muted p-8 text-center text-sm">
            We couldn’t reach the mushaf right now — please refresh in a moment.
          </p>
        ) : (
          <ul className="bg-paper-200/50 grid gap-px sm:grid-cols-2 md:grid-cols-3">
            {surahs.map((s) => (
              <li key={s.surah}>
                <Link
                  href={`/read/${s.surah.toString()}`}
                  className="bg-paper hover:bg-paper-100 group flex items-baseline justify-between gap-4 px-5 py-4 transition-colors"
                >
                  <div className="flex min-w-0 items-baseline gap-4">
                    <span className="smallcaps text-ink-muted w-6 shrink-0 font-mono text-xs tabular-nums">
                      {s.surah.toString().padStart(3, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-ink group-hover:text-leaf truncate text-lg leading-tight transition-colors">
                        {s.nameEnglish}
                      </p>
                      <p className="text-ink-muted text-xs">
                        {s.verseCount.toString()} verses · {s.revelationPlace}
                      </p>
                    </div>
                  </div>
                  <span
                    dir="rtl"
                    className="font-arabic text-ink-strong shrink-0 text-2xl"
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
  );
}

function HomeFooter(): ReactNode {
  return (
    <footer className="mx-auto max-w-6xl px-6 py-12">
      <div className="rule-hairline" />
      <div className="text-ink-muted mt-6 flex flex-wrap items-baseline justify-between gap-3 text-xs">
        <p>
          Quranic text via{' '}
          <a
            href="https://qul.tarteel.ai"
            className="text-leaf underline-offset-4 hover:underline"
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

function FeatureCell({
  icon: Icon,
  title,
  arabic,
  body,
  href,
  delay,
}: FeatureCellProps): ReactNode {
  return (
    <Link
      href={href}
      className={`bg-paper hover:bg-paper-100 reveal group p-8 transition-colors md:p-10 reveal-${delay.toString()}`}
    >
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <Icon size={26} className="text-ink-muted group-hover:text-leaf transition-colors" />
        <span
          dir="rtl"
          className="font-arabic text-ink-muted group-hover:text-leaf text-xl transition-colors"
          style={{ unicodeBidi: 'plaintext', lineHeight: 1 }}
        >
          {arabic}
        </span>
      </div>
      <h3 className="font-display text-ink group-hover:text-ink-strong mb-3 text-3xl font-light tracking-tight">
        {title}
      </h3>
      <p className="text-ink-muted text-base leading-relaxed">{body}</p>
      <span
        aria-hidden
        className="smallcaps text-ink-muted group-hover:text-leaf mt-6 inline-flex items-center gap-2 text-sm transition-colors"
      >
        Open <span className="rtl-flip">→</span>
      </span>
    </Link>
  );
}
