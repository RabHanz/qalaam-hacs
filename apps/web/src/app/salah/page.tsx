/**
 * /salah — companion surface for prayer times + Qibla + Hijri date.
 *
 * Pure client-side because we need browser geolocation. Server shell
 * provides only the page chrome; SalahClient owns the geolocation
 * permission flow + API calls + countdown timers + Qibla compass.
 */
import { SalahClient } from '../../components/SalahClient.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export default function SalahPage(): ReactNode {
  return (
    <>
      <SiteNav />
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Prayer · Qibla · Hijri</p>
          <h1 className="font-display text-ink-strong mt-2 text-3xl font-light tracking-tight sm:text-5xl">
            Salah today.
          </h1>
          <p className="text-ink-muted mt-2 max-w-prose text-sm leading-relaxed sm:text-base">
            Your prayer times, the bearing toward Makkah, and the Hijri date — quiet, accurate, all
            in one place.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <SalahClient />
      </main>
    </>
  );
}
