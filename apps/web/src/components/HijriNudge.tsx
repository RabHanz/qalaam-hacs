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
import { useEffect, useMemo, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import type { ReactNode } from 'react';

interface PrayerTimes {
  readonly fajr: string;
  readonly sunrise: string;
  readonly dhuhr: string;
  readonly asr: string;
  readonly maghrib: string;
  readonly isha: string;
}
interface PrayerTimesResp {
  readonly times: PrayerTimes;
  readonly date: string;
}

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
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [isFriday, setIsFriday] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

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
    // Suhoor/Iftar countdown needs prayer times. Read from
    // localStorage (the /salah page stores last-known coords). If
    // not present, the Ramadan branch falls back to a coarser nudge.
    void (async () => {
      try {
        const raw = window.localStorage.getItem('qalaam-location');
        if (!raw) return;
        const loc = JSON.parse(raw) as { lat?: number; lon?: number };
        if (typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return;
        const params = new URLSearchParams({
          lat: loc.lat.toString(),
          lon: loc.lon.toString(),
          method: window.localStorage.getItem('qalaam-prayer-method') ?? 'muslim-world-league',
          asr_school: window.localStorage.getItem('qalaam-asr-school') ?? 'shafii',
        });
        const res = await fetch(`${resolveApiBase()}/v1/prayer-times?${params.toString()}`);
        if (!res.ok) return;
        const body = (await res.json()) as PrayerTimesResp;
        if (!cancelled.v) setTimes(body.times);
      } catch {
        /* ignore */
      }
    })();
    // Tick every 30s so the countdown stays fresh without burning
    // battery on a 1Hz update.
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => {
      cancelled.v = true;
      window.clearInterval(id);
    };
  }, []);

  // Compute next milestone for Ramadan suhoor/iftar countdown.
  const ramadanCountdown = useMemo(() => {
    if (!times || !data?.isRamadan) return null;
    const fajr = new Date(times.fajr).getTime();
    const maghrib = new Date(times.maghrib).getTime();
    if (now < fajr) {
      return { kind: 'suhoor' as const, target: fajr };
    }
    if (now < maghrib) {
      return { kind: 'iftar' as const, target: maghrib };
    }
    return null; // after iftar — show generic Ramadan nudge below
  }, [times, data, now]);

  // Compose nudge content. Order: Ramadan (with suhoor/iftar countdown
  // when prayer times are known) > Hijri event > Friday Kahf.
  if (data?.isRamadan) {
    // Daily juz: 1 juz per Ramadan day → finish khatm by 30th. Maps day
    // → first surah of that juz so the user can jump straight in.
    const juz = Math.min(30, Math.max(1, data.hijri.day));
    const eyebrow = data.isLastTenNightsOfRamadan
      ? 'Ramaḍān · last ten nights'
      : 'Ramaḍān · رَمَضَان';
    if (ramadanCountdown) {
      return (
        <NudgeShell
          eyebrow={eyebrow}
          title={
            ramadanCountdown.kind === 'suhoor'
              ? `Suhoor ends in ${formatRemaining(ramadanCountdown.target - now)}.`
              : `Iftar in ${formatRemaining(ramadanCountdown.target - now)}.`
          }
          subtitle={
            ramadanCountdown.kind === 'suhoor'
              ? `Day ${data.hijri.day.toString()} of Ramaḍān · juz ${juz.toString()} for today's khatm.`
              : `Day ${data.hijri.day.toString()} of Ramaḍān · today's juz is ${juz.toString()}.`
          }
          href={`/read/${juzToSurah(juz).toString()}`}
          cta={`Open juz ${juz.toString()}`}
        />
      );
    }
    return (
      <NudgeShell
        eyebrow={eyebrow}
        title={
          data.isLastTenNightsOfRamadan
            ? 'Seek Laylat al-Qadr in the odd nights.'
            : 'Ramaḍān Mubārak.'
        }
        subtitle={
          data.isLastTenNightsOfRamadan
            ? `${data.hijri.day.toString()} Ramaḍān · pace your wird, prepare for the night.`
            : `${data.hijri.day.toString()} Ramaḍān ${data.hijri.year.toString()} · juz ${juz.toString()} keeps you on the daily khatm.`
        }
        href={`/read/${juzToSurah(juz).toString()}`}
        cta={`Open juz ${juz.toString()}`}
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
/** First surah number of each juz (1-30). Maps Ramadan day → reading
 *  starting point so the user finishes a khatm by the end of the
 *  month. Source: standard Madani 15-line juz division. */
const JUZ_FIRST_SURAH: readonly number[] = [
  1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 9, 11, 12, 15, 17, 18, 21, 23, 25, 27, 29, 33, 36, 39, 41, 46,
  51, 58, 67, 78,
];
function juzToSurah(juz: number): number {
  const idx = Math.max(0, Math.min(29, juz - 1));
  return JUZ_FIRST_SURAH[idx] ?? 1;
}

/** Format milliseconds → "Hh Mm" or "Mm" / "Now" for short remainders. */
function formatRemaining(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return 'less than a minute';
  if (totalMin < 60) return `${totalMin.toString()} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h.toString()}h` : `${h.toString()}h ${m.toString()}m`;
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
