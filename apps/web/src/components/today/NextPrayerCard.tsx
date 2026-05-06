'use client';

/**
 * NextPrayerCard — minimal next-prayer countdown for the Today rail.
 *
 * Behaviour:
 *   - On mount, asks the browser for geolocation. If granted, fetches
 *     /v1/prayer-times for the user's coords. If not, renders nothing
 *     (no nag, no "set your location" nudge — that lives on /salah).
 *   - Tick once per minute; recomputes the next-prayer label.
 *   - Does NOT play adhan, does NOT push notifications. Adab.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { resolveApiBase } from '../../lib/api-base.js';

import type { ReactNode } from 'react';

interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

interface NextPrayer {
  name: string;
  arabic: string;
  hhmm: string;
  delta: string;
}

const NAMES: { key: keyof PrayerTimes; en: string; ar: string }[] = [
  { key: 'fajr', en: 'Fajr', ar: 'الفَجْر' },
  { key: 'sunrise', en: 'Sunrise', ar: 'الشُّرُوق' },
  { key: 'dhuhr', en: 'Dhuhr', ar: 'الظُّهْر' },
  { key: 'asr', en: 'Asr', ar: 'العَصْر' },
  { key: 'maghrib', en: 'Maghrib', ar: 'المَغْرِب' },
  { key: 'isha', en: 'Isha', ar: 'العِشَاء' },
];

function formatHM(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function formatDelta(minutes: number): string {
  if (minutes <= 0) return 'now';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `in ${m.toString()}m`;
  if (m === 0) return `in ${h.toString()}h`;
  return `in ${h.toString()}h ${m.toString()}m`;
}

function pickNextPrayer(times: PrayerTimes, now: Date): NextPrayer | null {
  const nowMs = now.getTime();
  for (const slot of NAMES) {
    const ts = new Date(times[slot.key]).getTime();
    if (Number.isNaN(ts)) continue;
    if (ts > nowMs) {
      return {
        name: slot.en,
        arabic: slot.ar,
        hhmm: formatHM(times[slot.key]),
        delta: formatDelta(Math.round((ts - nowMs) / 60_000)),
      };
    }
  }
  // After Isha — surface tomorrow's Fajr by adding 24h to the current
  // (today's) Fajr. The actual next-day computation lives on /salah;
  // here we just need a reasonable countdown.
  const fajrTs = new Date(times.fajr).getTime();
  if (Number.isNaN(fajrTs)) return null;
  const tomorrowFajr = fajrTs + 24 * 60 * 60_000;
  return {
    name: 'Fajr',
    arabic: 'الفَجْر',
    hhmm: formatHM(times.fajr),
    delta: formatDelta(Math.round((tomorrowFajr - nowMs) / 60_000)),
  };
}

export function NextPrayerCard(): ReactNode {
  const apiBase = resolveApiBase();
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [next, setNext] = useState<NextPrayer | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      setTried(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lifecycle = { cancelled: false };
        void (async () => {
          try {
            const url = new URL(`${apiBase}/v1/prayer-times`, window.location.origin);
            url.searchParams.set('lat', pos.coords.latitude.toFixed(4));
            url.searchParams.set('lon', pos.coords.longitude.toFixed(4));
            const res = await fetch(url);
            if (!res.ok) {
              if (!lifecycle.cancelled) setTried(true);
              return;
            }
            const body = (await res.json()) as { times: PrayerTimes };
            if (!lifecycle.cancelled) {
              setTimes(body.times);
              setTried(true);
            }
          } catch {
            if (!lifecycle.cancelled) setTried(true);
          }
        })();
        return () => {
          lifecycle.cancelled = true;
        };
      },
      () => {
        // Permission denied — silent, no nag.
        setTried(true);
      },
      { timeout: 4000, maximumAge: 60_000 * 60 * 6 },
    );
  }, [apiBase]);

  // Tick the countdown once per minute.
  useEffect(() => {
    if (!times) return;
    setNext(pickNextPrayer(times, new Date()));
    const id = window.setInterval(() => {
      setNext(pickNextPrayer(times, new Date()));
    }, 60_000);
    return () => {
      window.clearInterval(id);
    };
  }, [times]);

  if (!tried || !next) return null;

  return (
    <Link
      href="/salah"
      className="paper-card hover:border-leaf/40 group block p-5 transition-colors sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="smallcaps text-leaf text-[10px] tracking-widest">Next prayer · صَلَاة</p>
        <p className="text-ink-muted font-mono text-[11px] tabular-nums">{next.delta}</p>
      </div>

      <p className="font-display text-ink-strong mt-3 text-2xl font-light leading-tight tracking-tight sm:text-3xl">
        {next.name}
        <span className="text-ink-muted ml-2 font-mono text-base tabular-nums sm:text-lg">
          {next.hhmm}
        </span>
      </p>

      <p
        dir="rtl"
        lang="ar"
        className="font-arabic text-ink-muted mt-1 text-lg sm:text-xl"
        style={{ unicodeBidi: 'plaintext', lineHeight: 1.4 }}
      >
        {next.arabic}
      </p>
    </Link>
  );
}
