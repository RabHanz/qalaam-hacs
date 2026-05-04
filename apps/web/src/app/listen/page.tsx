/**
 * /listen — ambient passive playback (Listen Mode).
 *
 * Design intent: ambient calm. Hero "now playing" card with the verse-key
 * set in display size, reciter line in Arabic + English, then a long
 * editorial reciter list (NOT a card grid). Should feel like the cover of
 * a vinyl album, not an MP3 player.
 *
 * Per strategy §10.1: low-volume loop of the user's current memorization
 * portion. Adhan-aware. Never interrupts prayer.
 */
import { Suspense } from 'react';

import { EmptyState } from '../../components/EmptyState.js';
import { CrescentGlyph, HairlineDivider } from '../../components/Glyph.js';
import { LoadingState } from '../../components/LoadingState.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Listen',
  description: 'Ambient low-volume playback of your current memorization portion.',
};

interface NowPlayingPayload {
  speaker_id: string;
  verse_key: string | null;
  reciter_slug: string | null;
  position_ms: number;
  is_playing: boolean;
  updated_at?: string;
}

interface Reciter {
  id: string;
  slug: string;
  name: { en: string; ar: string };
  style: string;
  riwayah: string;
}

async function fetchNowPlaying(baseUrl: string): Promise<NowPlayingPayload | null> {
  try {
    const res = await fetch(`${baseUrl}/v1/now-playing/qalaam`, { next: { revalidate: 5 } });
    if (!res.ok) return null;
    return (await res.json()) as NowPlayingPayload;
  } catch {
    return null;
  }
}

async function fetchReciters(baseUrl: string): Promise<readonly Reciter[]> {
  try {
    const res = await fetch(`${baseUrl}/v1/reciters`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { reciters?: Reciter[] };
    return body.reciters ?? [];
  } catch {
    return [];
  }
}

async function ListenContent({ baseUrl }: { baseUrl: string }): Promise<ReactNode> {
  const [np, reciters] = await Promise.all([fetchNowPlaying(baseUrl), fetchReciters(baseUrl)]);

  if (!np) {
    return (
      <EmptyState
        title="Backend unreachable"
        hint="Could not reach the Qalaam backend. Listen Mode reads from /v1/now-playing/qalaam."
      />
    );
  }

  const activeReciter = reciters.find((r) => r.slug === np.reciter_slug);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* HERO — now playing */}
      <div className="lg:col-span-7 reveal">
        <section
          aria-label="Now playing"
          className="paper-card-raised relative overflow-hidden p-10 md:p-14"
        >
          <div
            className="absolute right-0 top-0 h-full w-1/2 opacity-30"
            style={{
              background:
                'radial-gradient(circle at 75% 30%, var(--color-leaf-300) 0%, transparent 60%)',
            }}
            aria-hidden
          />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <CrescentGlyph size={20} className="text-leaf" />
              <span className="smallcaps text-leaf text-xs">
                Now playing · qalaam virtual speaker
              </span>
            </div>

            <p
              className="font-display text-7xl md:text-8xl font-light tracking-tight text-ink-strong tabular-nums"
              style={{ lineHeight: 0.95 }}
            >
              {np.verse_key ?? '—'}
            </p>

            <div className="mt-8 flex items-baseline gap-4 flex-wrap">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs smallcaps ${
                  np.is_playing ? 'bg-leaf text-paper' : 'bg-paper-200 text-ink-muted'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    np.is_playing ? 'bg-paper animate-pulse' : 'bg-ink-muted'
                  }`}
                />
                {np.is_playing ? 'Playing' : 'Idle'}
              </span>
              {np.position_ms > 0 ? (
                <span className="font-mono text-sm text-ink-muted tabular-nums">
                  {(np.position_ms / 1000).toFixed(1)}s
                </span>
              ) : null}
            </div>

            <HairlineDivider />

            <div className="grid gap-2">
              <p className="smallcaps text-leaf text-xs">Reciter</p>
              {activeReciter ? (
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <p className="font-display text-2xl text-ink">{activeReciter.name.en}</p>
                  <p
                    dir="rtl"
                    className="font-arabic text-2xl text-ink-strong"
                    style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
                  >
                    {activeReciter.name.ar}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-muted italic">No reciter set.</p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 paper-card p-6">
          <div className="flex items-start gap-4">
            <CrescentGlyph size={18} className="text-leaf mt-0.5 shrink-0" />
            <p className="text-sm text-ink-muted leading-relaxed">
              Listen Mode plays your current sabaq + sabqi quietly across any
              speaker connected via Cast, Sonos, AirPlay, MQTT, or Home
              Assistant. Adhan-aware — pauses for prayer windows. Speaker
              picker arrives when Phase 10 device-bridge integration tests close.
            </p>
          </div>
        </section>
      </div>

      {/* RECITER LIST */}
      <aside className="lg:col-span-5 reveal reveal-2">
        <div className="paper-card-raised p-8">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display text-2xl font-light tracking-tight">Reciter catalog</h2>
            <span className="smallcaps text-leaf text-xs">
              {reciters.length.toString()} available
            </span>
          </div>

          {reciters.length === 0 ? (
            <p className="text-sm text-ink-muted italic">No reciters available.</p>
          ) : (
            <ul className="grid gap-px bg-paper-200/40">
              {reciters.map((r) => {
                const active = r.slug === np.reciter_slug;
                return (
                  <li key={r.slug}>
                    <div
                      className={`flex items-baseline justify-between gap-4 px-4 py-3 ${
                        active ? 'bg-paper-100' : 'bg-paper'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-display text-base truncate ${
                            active ? 'text-leaf' : 'text-ink'
                          }`}
                        >
                          {r.name.en}
                          {active ? (
                            <span className="ml-2 text-xs smallcaps text-leaf">· current</span>
                          ) : null}
                        </p>
                        <p className="text-xs smallcaps text-ink-muted mt-0.5">
                          {r.style} · {r.riwayah}
                        </p>
                      </div>
                      <p
                        dir="rtl"
                        className="font-arabic text-lg text-ink-muted shrink-0"
                        style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
                      >
                        {r.name.ar}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function ListenPage(): ReactNode {
  const baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';

  return (
    <>
      <SiteNav />

      <header className="border-b border-hairline">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="smallcaps text-leaf text-xs">Listen Mode · إِسْتِمَاع</p>
          <h1 className="font-display mt-3 text-4xl md:text-5xl font-light tracking-tight">
            Your sabaq, in the air.
          </h1>
          <p className="mt-3 max-w-prose text-base text-ink-muted leading-relaxed">
            Plays your current memorization portion at low volume around the
            home. Adhan-aware. Pauses for prayer windows.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <Suspense fallback={<LoadingState label="Loading Listen Mode…" lines={4} />}>
          <ListenContent baseUrl={baseUrl} />
        </Suspense>
      </div>
    </>
  );
}
