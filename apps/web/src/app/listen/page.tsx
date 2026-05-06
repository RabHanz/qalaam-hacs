/**
 * /listen — actual audio playback surface, not a stub.
 *
 * Mobile-first layout: a sticky MiniPlayer at the bottom does the actual
 * audio. The page above lets the user pick a surah + reciter and start
 * listening. Reciter cards are tappable and show a "Now playing" tag on
 * the active one.
 */
import { Suspense } from 'react';

import { JumpToPicker } from '../../components/JumpToPicker.js';
import { ListenSurfaceClient } from '../../components/ListenSurfaceClient.js';
import { LoadingState } from '../../components/LoadingState.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Listen · Qalaam',
  description: 'Quran audio playback — pick a surah, pick a reciter, listen.',
};

interface SurahMeta {
  surah: number;
  nameArabic: string;
  nameEnglish: string;
  verseCount: number;
  revelationPlace: 'makkah' | 'madinah';
}

interface ReciterApiItem {
  id: string;
  slug: string;
  name: { en: string; ar: string };
  style: string;
  riwayah: string;
  segmentCoverage: number;
}

async function fetchJson<T>(url: string, revalidate = 86400): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Always render per-request — the backend is on the Docker network at
// http://qalaam-backend:4111 and ISN'T running during `next build`,
// so static generation would bake empty/null data. Per-request
// rendering hits the live backend each time.
export const dynamic = 'force-dynamic';

export default async function ListenPage(): Promise<ReactNode> {
  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';

  const [surahsBody, recitersBody] = await Promise.all([
    fetchJson<{ data: SurahMeta[] }>(`${apiBase}/v1/metadata/surahs`),
    fetchJson<{ reciters: ReciterApiItem[] }>(`${apiBase}/v1/reciters`),
  ]);

  const surahs = surahsBody?.data ?? [];
  const reciters = recitersBody?.reciters ?? [];

  return (
    <>
      <SiteNav />

      {/* Editorial header */}
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Listen · إِسْتِمَاع</p>
          <h1 className="font-display text-ink-strong mt-2 text-3xl font-light tracking-tight sm:text-4xl md:text-5xl">
            Pick a reciter.
            <br className="sm:hidden" /> Press play.
          </h1>
          <p className="text-ink-muted mt-3 max-w-prose text-sm leading-relaxed sm:text-base">
            Audio streams from QUL via the Quran.com CDN. Player stays docked at the bottom;
            auto-advances; returns where you left off.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-32 sm:px-6 sm:py-10 sm:pb-36">
        <Suspense fallback={<LoadingState label="Loading reciters…" lines={4} />}>
          <ListenSurfaceClient apiBase={apiBase} reciters={reciters} surahs={surahs} />
        </Suspense>
      </main>

      <JumpToPicker mode="listen" apiBase={apiBase} />
    </>
  );
}
