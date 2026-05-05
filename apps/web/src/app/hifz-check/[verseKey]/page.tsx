/**
 * /hifz-check/[verseKey] — browser-side Tarteel-style recite-and-check.
 *
 * Pairs with the existing WebSocket-backed /recite/[verseKey] surface:
 *   - /recite      uses the real-time-feedback WS service (server ASR)
 *   - /hifz-check  is a no-server-required MVP using the browser's
 *     Web Speech API; works offline-ish, audio never leaves the device.
 *
 * Per ADR-0005 (on-device ASR) the ideal end-state is a Whisper-based
 * worker the user can run locally; this surface gives a usable demo
 * today with zero infra dependency.
 */
import { QalaamError } from '@qalaam/core';

import { EmptyState } from '../../../components/EmptyState.js';
import { HifzCheckClient } from '../../../components/HifzCheckClient.js';
import { SiteNav } from '../../../components/SiteNav.js';
import { qalaamClient } from '../../../lib/qalaam-client.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ verseKey: string }>;
}

export default async function HifzCheckPage({ params }: PageProps): Promise<ReactNode> {
  const { verseKey: raw } = await params;
  let verseKey = raw;
  try {
    verseKey = decodeURIComponent(raw);
  } catch {
    /* malformed escape — fall through to regex rejection */
  }
  if (!/^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/.test(verseKey)) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Bad verse key" hint={`Got "${verseKey}".`} />
        </div>
      </>
    );
  }

  let verse: { textUthmani: string } | null = null;
  try {
    const surah = Number.parseInt(verseKey.split(':')[0] ?? '1', 10);
    const response = await qalaamClient.getSurahVerses(surah);
    verse = response.verses.find((v) => v.verseKey === verseKey) ?? null;
  } catch (err) {
    if (err instanceof QalaamError) {
      return (
        <>
          <SiteNav />
          <div className="mx-auto max-w-3xl px-6 py-20">
            <EmptyState title="Quran data not loaded" hint={err.message} />
          </div>
        </>
      );
    }
    throw err;
  }

  if (!verse) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Verse not found" hint={verseKey} />
        </div>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Hifz check · حفظ</p>
          <h1 className="font-display text-ink-strong mt-1.5 text-2xl font-light sm:text-4xl">
            Recite from memory.
          </h1>
          <p className="text-ink-muted mt-2 max-w-prose text-sm">
            Tap the mic and recite verse <span className="font-mono">{verseKey}</span>. Your
            recitation is matched word-by-word against the canonical text. Nothing is sent to a
            server — audio is processed in your browser only.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <HifzCheckClient expectedText={verse.textUthmani} verseKey={verseKey} />
      </main>
    </>
  );
}
