'use client';

/**
 * SalahClient — companion surface (prayer times + Qibla + Hijri).
 *
 * UX:
 *   1. Ask for geolocation on mount; remember the last known position
 *      in localStorage as a fast-path for repeat visits.
 *   2. Fetch /v1/prayer-times, /v1/qibla, /v1/hijri/today in parallel.
 *   3. Render: today's prayer card + countdown to next, Qibla compass
 *      (rotates with DeviceOrientation when available), Hijri ribbon
 *      with active Islamic events.
 *
 * Privacy: location stays in localStorage only; never sent anywhere
 * except the same-origin /v1/* calls. Method picker + asr-school live
 * in localStorage so the user's setup persists.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import type { ReactNode } from 'react';

interface PrayerTimes {
  readonly imsak: string;
  readonly fajr: string;
  readonly sunrise: string;
  readonly dhuhr: string;
  readonly asr: string;
  readonly maghrib: string;
  readonly isha: string;
}
interface PrayerTimesResponse {
  readonly times: PrayerTimes;
  readonly method: string;
  readonly asrSchool: string;
}
interface QiblaResponse {
  readonly bearingDegrees: number;
  readonly bearingCompass: string;
}
interface HijriToday {
  readonly hijri: {
    year: number;
    month: number;
    day: number;
    monthEnglish?: string;
    monthArabic?: string;
  };
  readonly isRamadan: boolean;
  readonly isLastTenNightsOfRamadan: boolean;
  readonly events: readonly { name: string; nameAr: string; significance: string }[];
}

const PRAYER_LABELS: Record<keyof PrayerTimes, { en: string; ar: string }> = {
  imsak: { en: 'Imsak', ar: 'الإمساك' },
  fajr: { en: 'Fajr', ar: 'الفجر' },
  sunrise: { en: 'Sunrise', ar: 'الشروق' },
  dhuhr: { en: 'Dhuhr', ar: 'الظهر' },
  asr: { en: 'Asr', ar: 'العصر' },
  maghrib: { en: 'Maghrib', ar: 'المغرب' },
  isha: { en: 'Isha', ar: 'العشاء' },
};

const STORE_LOC = 'qalaam-location';
const STORE_METHOD = 'qalaam-prayer-method';
const STORE_ASR = 'qalaam-asr-school';

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtRemaining(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return 'now';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `in ${h.toString()}h ${m.toString()}m`;
  if (m > 0) return `in ${m.toString()} min`;
  return 'in <1 min';
}

export function SalahClient(): ReactNode {
  const apiBase = resolveApiBase();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [permError, setPermError] = useState<string | null>(null);
  const [method, setMethod] = useState<string>('muslim-world-league');
  const [asrSchool, setAsrSchool] = useState<string>('shafii');
  const [times, setTimes] = useState<PrayerTimesResponse | null>(null);
  const [qibla, setQibla] = useState<QiblaResponse | null>(null);
  const [hijri, setHijri] = useState<HijriToday | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Restore from localStorage.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_LOC);
      if (raw) {
        const parsed = JSON.parse(raw) as { lat: number; lon: number };
        if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) setCoords(parsed);
      }
      const m = window.localStorage.getItem(STORE_METHOD);
      if (m) setMethod(m);
      const a = window.localStorage.getItem(STORE_ASR);
      if (a) setAsrSchool(a);
    } catch {
      /* ignore */
    }
  }, []);

  // Tick once per minute for countdown freshness.
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  // Acquire geolocation on demand.
  const acquireLocation = useCallback(() => {
    setPermError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(next);
        try {
          window.localStorage.setItem(STORE_LOC, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      },
      (err) => {
        setPermError(err.message || 'Location permission denied.');
      },
      { maximumAge: 600_000, timeout: 8_000 },
    );
  }, []);

  // Fetch prayer times + qibla + hijri whenever inputs change.
  useEffect(() => {
    if (!coords) return;
    const cancelled = { v: false };
    void (async () => {
      const url = new URL(`${apiBase}/v1/prayer-times`);
      url.searchParams.set('lat', coords.lat.toString());
      url.searchParams.set('lon', coords.lon.toString());
      url.searchParams.set('method', method);
      url.searchParams.set('asr_school', asrSchool);
      const [pt, qb, hj] = await Promise.all([
        fetch(url.toString())
          .then(async (r) => (r.ok ? ((await r.json()) as PrayerTimesResponse) : null))
          .catch(() => null),
        fetch(`${apiBase}/v1/qibla?lat=${coords.lat.toString()}&lon=${coords.lon.toString()}`)
          .then(async (r) => (r.ok ? ((await r.json()) as QiblaResponse) : null))
          .catch(() => null),
        fetch(`${apiBase}/v1/hijri/today`)
          .then(async (r) => (r.ok ? ((await r.json()) as HijriToday) : null))
          .catch(() => null),
      ]);
      if (cancelled.v) return;
      setTimes(pt);
      setQibla(qb);
      setHijri(hj);
    })();
    return () => {
      cancelled.v = true;
    };
  }, [coords, method, asrSchool, apiBase]);

  // Compass: subscribe to DeviceOrientationEvent.alpha (rotational angle
  // from compass north). Safari requires a user-gesture prompt that we
  // surface as a button.
  const enableCompass = useCallback(() => {
    interface OrientationEventClass {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    }
    const D = DeviceOrientationEvent as unknown as OrientationEventClass;
    const subscribe = (): void => {
      window.addEventListener(
        'deviceorientation',
        (e) => {
          const alpha = e.alpha;
          if (typeof alpha === 'number') setDeviceHeading(alpha);
        },
        true,
      );
    };
    if (typeof D.requestPermission === 'function') {
      void D.requestPermission().then((res) => {
        if (res === 'granted') subscribe();
      });
    } else {
      subscribe();
    }
  }, []);

  // Compute the next prayer + countdown.
  const next = useMemo(() => {
    if (!times) return null;
    const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
    for (const key of order) {
      const t = new Date(times.times[key]);
      if (t.getTime() > now) return { key, at: t };
    }
    return null;
  }, [times, now]);

  return (
    <div className="space-y-8">
      {/* Hijri ribbon */}
      {hijri ? (
        <section className="paper-card-raised flex flex-wrap items-baseline justify-between gap-3 p-5 sm:p-6">
          <div>
            <p className="smallcaps text-leaf text-[10px] tracking-widest">Hijri date</p>
            <p className="font-display text-ink-strong mt-1 text-2xl">
              {hijri.hijri.day.toString()} {hijri.hijri.monthEnglish ?? ''}{' '}
              {hijri.hijri.year.toString()}
            </p>
            {hijri.hijri.monthArabic ? (
              <p
                dir="rtl"
                lang="ar"
                className="font-arabic text-ink-muted mt-0.5 text-base"
                style={{
                  fontFamily: '"UthmanicHafs", "Amiri Quran", serif',
                  unicodeBidi: 'plaintext',
                }}
              >
                {hijri.hijri.day.toString()} {hijri.hijri.monthArabic}
              </p>
            ) : null}
          </div>
          {hijri.events.length > 0 ? (
            <ul className="m-0 flex max-w-[60%] list-none flex-wrap justify-end gap-1.5 p-0">
              {hijri.events.map((e) => (
                <li
                  key={e.name}
                  className={`smallcaps rounded-full px-2.5 py-0.5 text-[10px] tracking-widest ${
                    e.significance === 'major'
                      ? 'bg-leaf text-paper'
                      : 'border-hairline text-leaf border'
                  }`}
                >
                  {e.name}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* Location prompt */}
      {!coords ? (
        <section className="paper-card p-6 text-center sm:p-8">
          <p className="smallcaps text-leaf mb-2 text-[10px] tracking-widest">Location needed</p>
          <h2 className="font-display text-ink-strong mb-3 text-xl">
            Where are you praying today?
          </h2>
          <p className="text-ink-muted mx-auto mb-4 max-w-prose text-sm leading-relaxed">
            Prayer times depend on your latitude and longitude. Qalaam stores the coordinates only
            in your browser; nothing is sent to our servers except the same-origin computation
            request.
          </p>
          <button
            type="button"
            onClick={acquireLocation}
            className="bg-leaf text-paper smallcaps touch-manipulation rounded-full px-5 py-2.5 text-xs tracking-widest hover:opacity-95"
          >
            Use my location
          </button>
          {permError ? <p className="text-mistake-error mt-3 text-sm">{permError}</p> : null}
        </section>
      ) : null}

      {/* Prayer times card */}
      {times ? (
        <section aria-labelledby="salah-times" className="paper-card-raised p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="salah-times" className="font-display text-ink-strong text-xl sm:text-2xl">
              Today's prayers
            </h2>
            {next ? (
              <p className="smallcaps text-leaf text-[11px] tracking-widest">
                Next · {PRAYER_LABELS[next.key].en} {fmtRemaining(next.at)}
              </p>
            ) : null}
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
            {(Object.keys(times.times) as (keyof PrayerTimes)[]).map((k) => {
              const t = new Date(times.times[k]);
              const isPast = t.getTime() < now;
              const isNext = next?.key === k;
              return (
                <li
                  key={k}
                  className={`rounded-md p-3 text-center transition-colors ${
                    isNext
                      ? 'bg-leaf/15 ring-leaf/40 ring-1'
                      : isPast
                        ? 'bg-paper-100 opacity-60'
                        : 'bg-paper-100'
                  }`}
                >
                  <p className="smallcaps text-leaf text-[10px] tracking-widest">
                    {PRAYER_LABELS[k].en}
                  </p>
                  <p className="font-display text-ink-strong mt-0.5 text-base tabular-nums sm:text-lg">
                    {fmtTime(times.times[k])}
                  </p>
                  <p
                    dir="rtl"
                    lang="ar"
                    className="text-ink-muted mt-0.5 text-xs"
                    style={{ unicodeBidi: 'plaintext' }}
                  >
                    {PRAYER_LABELS[k].ar}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <label className="smallcaps text-ink-muted text-[10px] tracking-widest">
                Method
                <select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value);
                    try {
                      window.localStorage.setItem(STORE_METHOD, e.target.value);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="border-hairline bg-paper text-ink ml-1.5 rounded border px-2 py-1 text-xs"
                >
                  <option value="muslim-world-league">Muslim World League</option>
                  <option value="egyptian">Egyptian</option>
                  <option value="karachi">Karachi</option>
                  <option value="umm-al-qura">Umm al-Qura</option>
                  <option value="dubai">Dubai</option>
                  <option value="qatar">Qatar</option>
                  <option value="kuwait">Kuwait</option>
                  <option value="singapore">Singapore</option>
                  <option value="turkey">Turkey</option>
                  <option value="tehran">Tehran</option>
                  <option value="north-america">North America (ISNA)</option>
                  <option value="moon-sighting-committee">Moonsighting Committee</option>
                </select>
              </label>
              <label className="smallcaps text-ink-muted text-[10px] tracking-widest">
                Asr
                <select
                  value={asrSchool}
                  onChange={(e) => {
                    setAsrSchool(e.target.value);
                    try {
                      window.localStorage.setItem(STORE_ASR, e.target.value);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="border-hairline bg-paper text-ink ml-1.5 rounded border px-2 py-1 text-xs"
                >
                  <option value="shafii">Shafiʿi / Hanbali / Maliki</option>
                  <option value="hanafi">Hanafi</option>
                </select>
              </label>
            </div>
          </div>
        </section>
      ) : null}

      {/* Qibla compass */}
      {qibla ? (
        <section
          aria-labelledby="qibla-compass"
          className="paper-card-raised p-5 text-center sm:p-6"
        >
          <h2 id="qibla-compass" className="font-display text-ink-strong mb-4 text-xl sm:text-2xl">
            Qibla
          </h2>
          <div
            className="border-hairline relative mx-auto rounded-full border-2"
            style={{ width: 'min(70vw, 280px)', height: 'min(70vw, 280px)' }}
          >
            {/* North marker at top */}
            <span className="smallcaps text-ink-muted absolute left-1/2 top-1.5 -translate-x-1/2 text-[10px] tracking-widest">
              N
            </span>
            {/* Needle — rotates by (qibla bearing - device heading) so it
                always points at the Kaaba even as you turn. Without
                device heading, it just shows the absolute compass bearing. */}
            <div
              className="absolute left-1/2 top-1/2 origin-center"
              style={{
                width: '4px',
                height: '45%',
                transform: `translate(-50%, -100%) rotate(${(qibla.bearingDegrees - (deviceHeading ?? 0)).toString()}deg)`,
                transformOrigin: 'bottom center',
                background: 'linear-gradient(to top, transparent, var(--color-leaf-500))',
                transition: 'transform 200ms ease',
              }}
              aria-hidden
            />
            <span
              className="font-arabic text-leaf absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl"
              style={{ fontFamily: '"UthmanicHafs", "Amiri Quran", serif' }}
            >
              ﷽
            </span>
          </div>
          <p className="smallcaps text-ink-muted mt-4 text-[11px] tracking-widest">
            {qibla.bearingDegrees.toFixed(1)}° · {qibla.bearingCompass}
          </p>
          {deviceHeading === null ? (
            <button
              type="button"
              onClick={enableCompass}
              className="border-hairline smallcaps text-ink-muted hover:text-leaf hover:border-leaf/40 mt-3 touch-manipulation rounded-full border px-4 py-1.5 text-[11px] tracking-widest"
            >
              Use device compass
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
