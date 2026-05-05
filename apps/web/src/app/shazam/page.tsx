/**
 * /shazam — voice-search ("Shazam for Quran").
 *
 * User taps the mic, recites a phrase from any verse, and we route the
 * transcript through /v1/search (the FTS5 index built in #159) to find
 * the matching verse. Server-side rendering provides only the page
 * shell; ShazamClient owns the mic + transcript + result list.
 */
import { ShazamClient } from '../../components/ShazamClient.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export default function ShazamPage(): ReactNode {
  return (
    <>
      <SiteNav />
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Voice search · بحث صوتي</p>
          <h1 className="font-display text-ink-strong mt-2 text-3xl font-light tracking-tight sm:text-5xl">
            Recite a verse — find it.
          </h1>
          <p className="text-ink-muted mt-2 max-w-prose text-sm leading-relaxed sm:text-base">
            Forgot where a verse lives? Tap the mic and recite a phrase you remember. Qalaam routes
            the transcript through the same search index your typed queries hit.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <ShazamClient />
      </main>
    </>
  );
}
