/**
 * /listen — actual audio playback surface, not a stub.
 *
 * Mobile-first layout: a sticky MiniPlayer at the bottom does the actual
 * audio. The page above lets the user pick a surah + reciter and start
 * listening. Reciter cards are tappable and show a "Now playing" tag on
 * the active one.
 */
import Link from 'next/link';
import { Suspense } from 'react';

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
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">
            Listen · إِسْتِمَاع
          </p>
          <h1 className="font-display mt-2 text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-ink-strong">
            Pick a reciter.<br className="sm:hidden" /> Press play.
          </h1>
          <p className="mt-3 max-w-prose text-sm sm:text-base text-ink-muted leading-relaxed">
            Audio streams from QUL via the Quran.com CDN. Player stays
            docked at the bottom; auto-advances; returns where you left off.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10 pb-32 sm:pb-36">
        <Suspense fallback={<LoadingState label="Loading reciters…" lines={4} />}>
          <ListenSurfaceClient
            apiBase={apiBase}
            reciters={reciters}
            surahs={surahs}
          />
        </Suspense>
      </main>
    </>
  );
}
