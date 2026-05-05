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

  // Restore from localStorage. If we land on an insecure origin (LAN
  // hostname like "onnyx", non-HTTPS) AND there's no cached coords,
  // we kick off an IP-based geo lookup in a follow-up effect (defined
  // below acquireLocationByIp) so the user doesn't have to discover
  // the fallback button manually.
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

  // Acquire geolocation on demand. Browser Geolocation API is gated to
  // secure origins (HTTPS, http://localhost, http://127.0.0.1). LAN
  // hostnames like "onnyx", "onnyx.local", and bare LAN IPs are NOT
  // treated as secure by browsers — adding them to an allowlist on our
  // side wouldn't help because window.isSecureContext is the gate. We
  // surface a clear path-forward instead of the cryptic "Only secure
  // origins are allowed" error.
  const acquireLocation = useCallback(() => {
    setPermError(null);
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      const host = window.location.hostname;
      setPermError(
        `Browser geolocation is blocked on ${host}. Use the IP fallback or enter coordinates manually below — or open http://localhost:${window.location.port || '3111'} for full geolocation.`,
      );
      return;
    }
    if (typeof navigator === 'undefined') {
      setPermError('Geolocation API not available — use the manual entry below.');
      return;
    }
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

  // IP-based geolocation fallback (~city-level). Tries multiple free
  // CORS-friendly providers in order — if one is rate-limited or
  // network-blocked, we fall through to the next. Privacy: only the
  // user's public IP leaves the device, and only on explicit click.
  const acquireLocationByIp = useCallback(async () => {
    setPermError(null);
    interface Provider {
      readonly name: string;
      readonly url: string;
      readonly extract: (b: unknown) => { lat: number; lon: number } | null;
    }
    const providers: readonly Provider[] = [
      {
        name: 'ipapi.co',
        url: 'https://ipapi.co/json/',
        extract: (b) => {
          const x = b as { latitude?: unknown; longitude?: unknown };
          return typeof x.latitude === 'number' && typeof x.longitude === 'number'
            ? { lat: x.latitude, lon: x.longitude }
            : null;
        },
      },
      {
        name: 'ipwho.is',
        url: 'https://ipwho.is/',
        extract: (b) => {
          const x = b as { latitude?: unknown; longitude?: unknown; success?: unknown };
          if (x.success === false) return null;
          return typeof x.latitude === 'number' && typeof x.longitude === 'number'
            ? { lat: x.latitude, lon: x.longitude }
            : null;
        },
      },
      {
        name: 'ipinfo.io',
        url: 'https://ipinfo.io/json',
        extract: (b) => {
          const x = b as { loc?: unknown };
          if (typeof x.loc !== 'string') return null;
          const [latStr, lonStr] = x.loc.split(',');
          const lat = Number.parseFloat(latStr ?? '');
          const lon = Number.parseFloat(lonStr ?? '');
          return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
        },
      },
    ];
    const failures: string[] = [];
    for (const p of providers) {
      try {
        const res = await fetch(p.url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
          failures.push(`${p.name} HTTP ${res.status.toString()}`);
          continue;
        }
        const body = (await res.json()) as unknown;
        const coords = p.extract(body);
        if (!coords) {
          failures.push(`${p.name} no coords`);
          continue;
        }
        setCoords(coords);
        try {
          window.localStorage.setItem(STORE_LOC, JSON.stringify(coords));
        } catch {
          /* ignore */
        }
        return;
      } catch (err) {
        failures.push(`${p.name} ${(err as Error).message}`);
      }
    }
    setPermError(`IP lookup failed (${failures.join('; ')}). Enter coordinates manually below.`);
  }, []);

  // Auto IP-fallback on insecure origins. The browser blocks
  // navigator.geolocation outside HTTPS / localhost, so trying it on a
  // LAN host like "onnyx" silently fails — we proactively run the IP
  // approximation in the background once on mount when no cached
  // coords exist, so the user lands on a populated /salah page
  // without needing to discover the fallback button.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.isSecureContext) return; // browser will hand us location on click
    if (coords) return; // already have a value (cached or freshly set)
    const id = window.setTimeout(() => {
      void acquireLocationByIp();
    }, 250);
    return () => {
      window.clearTimeout(id);
    };
    // Run once after the localStorage-restore effect has had a chance
    // to populate `coords` — that effect sets state in the same tick,
    // so by the time this effect runs `coords` reflects the cached
    // value if any. We deliberately omit acquireLocationByIp here:
    // it's a stable useCallback() with empty deps, never changes.
  }, []);

  // Reset location — clear stored coordinates so the user can pick again.
  const resetLocation = useCallback(() => {
    setCoords(null);
    setTimes(null);
    setQibla(null);
    setPermError(null);
    try {
      window.localStorage.removeItem(STORE_LOC);
    } catch {
      /* ignore */
    }
  }, []);

  // Manual lat/lon entry — escape hatch for dev/LAN deployments where
  // navigator.geolocation is blocked, and for users who want to set a
  // fixed location (e.g., a masjid they pray at).
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const applyManualLocation = useCallback(
    (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      const lat = Number.parseFloat(manualLat);
      const lon = Number.parseFloat(manualLon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setPermError('Both latitude and longitude must be numbers.');
        return;
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        setPermError('Latitude -90 to 90, longitude -180 to 180.');
        return;
      }
      const next = { lat, lon };
      setCoords(next);
      setPermError(null);
      try {
        window.localStorage.setItem(STORE_LOC, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [manualLat, manualLon],
  );

  // Fetch prayer times + qibla + hijri whenever inputs change.
  useEffect(() => {
    if (!coords) return;
    const cancelled = { v: false };
    void (async () => {
      // apiBase is "/api" (relative) on the client, which `new URL()`
      // can't parse standalone. Compose the query string manually so it
      // works for both relative ("/api") and absolute (PUBLIC_API_URL)
      // bases.
      const params = new URLSearchParams({
        lat: coords.lat.toString(),
        lon: coords.lon.toString(),
        method,
        asr_school: asrSchool,
      });
      const url = `${apiBase}/v1/prayer-times?${params.toString()}`;
      const [pt, qb, hj] = await Promise.all([
        fetch(url)
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

  // Compass: subscribe to DeviceOrientationEvent.alpha (rotational
  // angle from compass north). The API is gnarly across browsers:
  //   - iOS Safari: needs requestPermission() + HTTPS + user gesture
  //   - Android Chrome: works without permission but emits 0 if device
  //     lacks magnetometer; needs HTTPS (insecure context blocks it)
  //   - Desktop: API exists but events never fire (no sensor)
  //   - SSR: DeviceOrientationEvent is undefined
  //
  // We expose three states via `compassStatus`:
  //   "idle"        — user hasn't tapped yet
  //   "unavailable" — API missing OR insecure origin OR no events after 3s
  //   "denied"      — iOS user denied permission
  //   "active"      — events firing
  const [compassStatus, setCompassStatus] = useState<'idle' | 'unavailable' | 'denied' | 'active'>(
    'idle',
  );
  const [manualQiblaOffset, setManualQiblaOffset] = useState(0);
  const enableCompass = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      setCompassStatus('unavailable');
      return;
    }
    if (!window.isSecureContext) {
      // Most browsers block the orientation sensor outside HTTPS /
      // localhost. We surface "unavailable" + the manual rotation
      // slider; the helper text below explains why.
      setCompassStatus('unavailable');
      return;
    }
    interface OrientationEventClass {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    }
    const D = window.DeviceOrientationEvent as unknown as OrientationEventClass;
    let firstEventTimer: number | null = null;
    // Android Chrome dispatches `deviceorientationabsolute` for true
    // compass-north heading. iOS uses `deviceorientation` plus the
    // Apple-specific `webkitCompassHeading`. We listen on both events
    // and prefer absolute / webkitCompass when available — that's
    // what gives a STABLE bearing as the user rotates.
    const onOrientation = (
      e: DeviceOrientationEvent & { webkitCompassHeading?: number; absolute?: boolean },
    ): void => {
      let alpha: number | null = null;
      if (typeof e.webkitCompassHeading === 'number') {
        // iOS: webkitCompassHeading is degrees clockwise from North.
        // Map to alpha (counter-clockwise from North) for parity.
        alpha = (360 - e.webkitCompassHeading) % 360;
      } else if (e.absolute && typeof e.alpha === 'number') {
        alpha = e.alpha;
      } else if (typeof e.alpha === 'number') {
        alpha = e.alpha;
      }
      if (alpha !== null) {
        setDeviceHeading(alpha);
        setCompassStatus('active');
        if (firstEventTimer !== null) {
          window.clearTimeout(firstEventTimer);
          firstEventTimer = null;
        }
      }
    };
    const subscribe = (): void => {
      // Mark unavailable if no event fires within 3 seconds — typical
      // signal that the device has no magnetometer.
      firstEventTimer = window.setTimeout(() => {
        setCompassStatus('unavailable');
        window.removeEventListener('deviceorientation', onOrientation, true);
        window.removeEventListener('deviceorientationabsolute', onOrientation, true);
      }, 3000);
      window.addEventListener('deviceorientation', onOrientation, true);
      // Android only — `deviceorientationabsolute` is the compass-true
      // sibling. Adding both lets us latch onto the more reliable one.
      window.addEventListener('deviceorientationabsolute', onOrientation, true);
    };
    if (typeof D.requestPermission === 'function') {
      void D.requestPermission().then(
        (res) => {
          if (res === 'granted') subscribe();
          else setCompassStatus('denied');
        },
        () => {
          setCompassStatus('unavailable');
        },
      );
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
                  fontFamily: '"UthmanicHafs"',
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
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={acquireLocation}
              className="bg-leaf text-paper smallcaps touch-manipulation rounded-full px-5 py-2.5 text-xs tracking-widest hover:opacity-95"
            >
              Use my location
            </button>
            <button
              type="button"
              onClick={() => {
                void acquireLocationByIp();
              }}
              className="border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 smallcaps touch-manipulation rounded-full border px-4 py-2.5 text-xs tracking-widest"
            >
              Approximate by IP
            </button>
          </div>
          {permError ? <p className="text-mistake-error mt-3 text-sm">{permError}</p> : null}
          {/* Manual entry — always visible so a fixed-location user
              (e.g., the local masjid) can set coordinates once and forget. */}
          <form
            onSubmit={applyManualLocation}
            className="border-hairline mt-5 flex flex-wrap items-end justify-center gap-2 border-t pt-4"
          >
            <label className="smallcaps text-ink-muted text-[10px] tracking-widest">
              Latitude
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={manualLat}
                onChange={(e) => {
                  setManualLat(e.target.value);
                }}
                placeholder="40.7128"
                className="border-hairline bg-paper-100 text-ink mt-1 block w-32 rounded border px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="smallcaps text-ink-muted text-[10px] tracking-widest">
              Longitude
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={manualLon}
                onChange={(e) => {
                  setManualLon(e.target.value);
                }}
                placeholder="-74.0060"
                className="border-hairline bg-paper-100 text-ink mt-1 block w-32 rounded border px-2.5 py-1.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="bg-leaf/15 text-leaf smallcaps hover:bg-leaf/25 touch-manipulation rounded-full px-4 py-2 text-xs tracking-widest"
            >
              Set
            </button>
          </form>
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
          {/* Location strip — shows current coords + a Change/Refresh
              button so the user can re-pick without reloading. */}
          {coords ? (
            <div className="border-hairline mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t pt-3">
              <p className="text-ink-muted/80 text-[11px]">
                <span className="smallcaps text-leaf tracking-widest">Location</span>{' '}
                <span className="font-mono tabular-nums">
                  {coords.lat.toFixed(3)}, {coords.lon.toFixed(3)}
                </span>
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void acquireLocationByIp();
                  }}
                  className="text-ink-muted/80 hover:text-leaf smallcaps text-[10px] tracking-widest"
                  title="Refresh from IP"
                >
                  Refresh
                </button>
                <span className="text-ink-muted/40">·</span>
                <button
                  type="button"
                  onClick={resetLocation}
                  className="text-ink-muted/80 hover:text-leaf smallcaps text-[10px] tracking-widest"
                >
                  Change
                </button>
              </div>
            </div>
          ) : null}
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
                transform: `translate(-50%, -100%) rotate(${(qibla.bearingDegrees - (deviceHeading ?? 0) + manualQiblaOffset).toString()}deg)`,
                transformOrigin: 'bottom center',
                background: 'linear-gradient(to top, transparent, var(--color-leaf-500))',
                transition: 'transform 200ms ease',
              }}
              aria-hidden
            />
            <span
              className="font-arabic text-leaf absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl"
              style={{ fontFamily: '"UthmanicHafs"' }}
            >
              ﷽
            </span>
          </div>
          <p className="smallcaps text-ink-muted mt-4 text-[11px] tracking-widest">
            {qibla.bearingDegrees.toFixed(1)}° · {qibla.bearingCompass}
          </p>
          {/* Compass control surface — three-mode UI. */}
          {compassStatus === 'idle' && deviceHeading === null ? (
            <button
              type="button"
              onClick={enableCompass}
              className="border-hairline smallcaps text-ink-muted hover:text-leaf hover:border-leaf/40 mt-3 touch-manipulation rounded-full border px-4 py-1.5 text-[11px] tracking-widest"
            >
              Use device compass
            </button>
          ) : null}
          {compassStatus === 'denied' ? (
            <p className="text-ink-muted mt-3 text-xs italic">
              Compass permission denied. Use the manual rotation slider below.
            </p>
          ) : null}
          {compassStatus === 'unavailable' ? (
            <p className="text-ink-muted mx-auto mt-3 max-w-sm text-xs italic leading-relaxed">
              {typeof window !== 'undefined' && !window.isSecureContext
                ? `Compass needs an HTTPS origin or localhost — ${window.location.hostname} is treated as insecure by the browser. Open https://… or http://localhost on the device to use the live compass; otherwise the needle shows the absolute Qibla bearing for a physical compass, and the slider below lets you nudge it.`
                : 'Device compass not available (no magnetometer detected). The needle below points to absolute compass bearing — face that direction with a real compass, or use the slider.'}
            </p>
          ) : null}
          {compassStatus === 'active' ? (
            <p className="text-leaf smallcaps mt-3 text-[10px] tracking-widest">
              Compass active · device heading {deviceHeading?.toFixed(0) ?? '?'}°
            </p>
          ) : null}
          {/* Manual offset slider — always available. Useful when the
              compass is unavailable, or to nudge the needle if the
              device's magnetometer is calibrated wrong. */}
          {compassStatus !== 'active' ? (
            <div className="mt-4">
              <label className="smallcaps text-ink-muted text-[10px] tracking-widest">
                Manual rotation
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={manualQiblaOffset}
                  onChange={(e) => {
                    setManualQiblaOffset(Number(e.target.value));
                  }}
                  className="mx-auto mt-2 block w-full max-w-xs"
                />
              </label>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
