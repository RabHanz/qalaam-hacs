'use client';

/**
 * TodayGreeting — time-of-day-aware greeting that opens the Today
 * surface for authenticated users.
 *
 * Time bands (local clock):
 *   04–07   Fajr / dawn        Good morning · صَبَاح النُّور
 *   07–12   morning            Good morning · صَبَاح الخَيْر
 *   12–17   afternoon          Good afternoon · مَرْحَبًا
 *   17–19   maghrib / evening  Good evening · مَسَاء الخَيْر
 *   19–24   night              Good evening · مَسَاء النُّور
 *   00–04   late night         Peace · السَّلَام عَلَيْكُم
 *
 * Renders deterministic copy on SSR ("Welcome,") and upgrades to the
 * time-aware greeting on client mount — so SSR HTML matches the first
 * client render bit-for-bit (no hydration mismatch), then the local
 * clock takes over.
 */
import { useEffect, useState } from 'react';

import type { ReactNode } from 'react';

interface Props {
  readonly displayName: string | null;
}

interface Greeting {
  readonly english: string;
  readonly arabic: string;
}

const FALLBACK: Greeting = { english: 'Welcome', arabic: 'أَهْلًا وَسَهْلًا' };

function pickGreeting(now: Date): Greeting {
  const h = now.getHours();
  if (h >= 4 && h < 7) return { english: 'Good morning', arabic: 'صَبَاح النُّور' };
  if (h >= 7 && h < 12) return { english: 'Good morning', arabic: 'صَبَاح الخَيْر' };
  if (h >= 12 && h < 17) return { english: 'Good afternoon', arabic: 'مَرْحَبًا' };
  if (h >= 17 && h < 19) return { english: 'Good evening', arabic: 'مَسَاء الخَيْر' };
  if (h >= 19) return { english: 'Good evening', arabic: 'مَسَاء النُّور' };
  return { english: 'Peace', arabic: 'السَّلَام عَلَيْكُم' };
}

export function TodayGreeting({ displayName }: Props): ReactNode {
  const [g, setG] = useState<Greeting>(FALLBACK);
  useEffect(() => {
    setG(pickGreeting(new Date()));
    // Re-pick every minute so a session that crosses a band boundary
    // updates without a refresh.
    const id = window.setInterval(() => {
      setG(pickGreeting(new Date()));
    }, 60_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const firstName = (displayName ?? '').trim().split(/\s+/)[0] ?? '';

  return (
    <div className="reveal">
      <p className="smallcaps text-leaf text-[11px] tracking-widest">Today · يَوْمُك</p>
      <h1 className="font-display text-ink-strong mt-3 text-3xl font-light leading-tight tracking-tight sm:text-4xl md:text-5xl">
        {g.english}
        {firstName ? <span className="text-ink">, {firstName}</span> : null}
        <span className="text-ink-muted mx-3 opacity-50">·</span>
        <span dir="rtl" lang="ar" className="font-arabic">
          {g.arabic}
        </span>
      </h1>
    </div>
  );
}
