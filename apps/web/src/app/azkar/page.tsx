/**
 * /azkar — daily azkar surface (Hisn al-Muslim curated subset).
 *
 * Tarteel and Quranly neither ship a full azkar surface. This is the
 * companion to /salah: prayer-times for WHEN to pray, azkar for what
 * to recite around it.
 *
 * Layout: category strip at the top → list of azkar in the active
 * category → tap-counter on each (mobile-friendly tasbih). Per CLAUDE.md
 * adab, no XP/streak/coin gamification — the count is reverent
 * scaffolding, never a leaderboard signal.
 */
import { AzkarClient } from '../../components/AzkarClient.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Azkar · Qalaam',
  description:
    'Daily azkar from Hisn al-Muslim — morning, evening, after prayer, sleep. Arabic, transliteration, English, and authentic hadith references.',
};

export default function AzkarPage(): ReactNode {
  return (
    <>
      <SiteNav />
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Azkar · أذكار</p>
          <h1 className="font-display text-ink-strong mt-2 text-3xl font-light tracking-tight sm:text-5xl">
            The remembrance of God,
            <br />
            <span className="text-leaf italic">across the day.</span>
          </h1>
          <p className="text-ink-muted mt-4 max-w-prose text-sm leading-relaxed sm:text-base">
            Curated du’as from <em>Hisn al-Muslim</em> — the Fortress of the Muslim by Saʿīd ibn
            Wahf al-Qaḥṭānī. Tap the count circle to track recitations; the count resets next time
            you open the app. Nothing is sent anywhere.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <AzkarClient />
        <p className="text-ink-muted/80 mt-12 text-center text-[11px] italic">
          Sources: Saḥīḥ al-Bukhārī, Saḥīḥ Muslim, Sunan Abī Dāwūd, Jāmiʿ al-Tirmidhī. English
          translation in the public domain. Arabic verified against the standard editions.
        </p>
      </main>
    </>
  );
}
