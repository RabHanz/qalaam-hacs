'use client';

/**
 * HijriNudge — calendar-aware contextual nudges for the home page.
 *
 * Surfaces:
 *   - Friday: Surah Kahf reminder (sunnah recitation; "whoever recites
 *     Surah Kahf on Friday will have a light shining for him from one
 *     Friday to the next").
 *   - Ramadan: ramadan-aware framing + jump to today's juz.
 *   - Hijri events from /v1/hijri/today (e.g., 1st Muharram, 9 Dhu
 *     al-Hijjah, 27 Rajab).
 *
 * Mobile-first. Hidden if no nudge applies. Reduced-motion aware.
 */
import { useEffect, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import type { ReactNode } from 'react';


interface HijriEvent {
  readonly slug: string;
  readonly name: string;
  readonly significance?: string;
}

interface HijriToday {
  readonly gregorian: string;
  readonly hijri: {
    readonly day: number;
    readonly month: number;
    readonly year: number;
    readonly monthNameEnglish?: string;
    readonly monthNameArabic?: string;
  };
  readonly isRamadan: boolean;
  readonly isLastTenNightsOfRamadan: boolean;
  readonly events: readonly HijriEvent[];
}

export function HijriNudge(): ReactNode {
  const [data, setData] = useState<HijriToday | null>(null);
  const [isFriday, setIsFriday] = useState(false);

  useEffect(() => {
    setIsFriday(new Date().getDay() === 5);
    const cancelled = { v: false };
    void (async () => {
      try {
        const res = await fetch(`${resolveApiBase()}/v1/hijri/today`);
        if (!res.ok) return;
        const body = (await res.json()) as HijriToday;
        if (!cancelled.v) setData(body);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled.v = true;
    };
  }, []);

  // Compose nudge content. Order: Ramadan > Hijri event > Friday.
  if (data?.isRamadan) {
    return (
      <NudgeShell
        eyebrow="Ramaḍān · رَمَضَان"
        title={
          data.isLastTenNightsOfRamadan
            ? 'The last ten nights — seek Laylat al-Qadr.'
            : 'Ramaḍān Mubārak.'
        }
        subtitle={
          data.isLastTenNightsOfRamadan
            ? `${data.hijri.day.toString()} Ramaḍān · pace your wird, prepare for night prayer.`
            : `${data.hijri.day.toString()} Ramaḍān ${data.hijri.year.toString()} · today's juz is part of the daily khatm.`
        }
        href={`/read/${((((data.hijri.day - 1) * 4 + 1) % 114) + 1).toString()}`}
        cta="Open today's reading"
      />
    );
  }

  if (data?.events && data.events.length > 0) {
    const event = data.events[0];
    if (event) {
      return (
        <NudgeShell
          eyebrow="Hijri event · حدث"
          title={event.name}
          subtitle={`${data.hijri.day.toString()} ${data.hijri.monthNameEnglish ?? ''} ${data.hijri.year.toString()}`}
          href="/salah"
          cta="See significance"
        />
      );
    }
  }

  if (isFriday) {
    return (
      <NudgeShell
        eyebrow="Jumuʿah · يَوْمُ الْجُمُعَة"
        title="Recite Surah al-Kahf today."
        subtitle={
          'Sunnah of Jumuʿah — "Whoever recites Surat al-Kahf on Friday will have a light from one Friday to the next."'
        }
        href="/read/18"
        cta="Open Sūrat al-Kahf"
      />
    );
  }

  return null;
}

interface ShellProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly cta: string;
}
function NudgeShell({ eyebrow, title, subtitle, href, cta }: ShellProps): ReactNode {
  return (
    <a
      href={href}
      className="paper-card-raised hover-rise group flex flex-col gap-2 px-5 py-5 sm:px-6 sm:py-6"
      style={{
        borderLeft: '3px solid var(--color-leaf-500, #1b4d5a)',
      }}
    >
      <p className="smallcaps text-leaf text-[10px] tracking-widest">{eyebrow}</p>
      <p className="font-display text-ink-strong text-lg sm:text-xl">{title}</p>
      <p className="text-ink-muted/90 text-sm leading-relaxed">{subtitle}</p>
      <p className="smallcaps text-leaf mt-1 text-[11px] tracking-widest">{cta} →</p>
    </a>
  );
}
