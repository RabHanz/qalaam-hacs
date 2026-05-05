/**
 * Prayer-time calculation. Wraps `adhan` (Batoul Apps, MIT).
 *
 * Per strategy §10.4: covers all major methods + custom angle adjustments +
 * high-latitude rules. The API surface is intentionally narrower than `adhan`'s
 * native one — Qalaam exposes only what we need today; extend as required.
 */
import {
  Coordinates as AdhanCoordinates,
  HighLatitudeRule as AdhanHighLatitudeRule,
  CalculationMethod as AdhanMethod,
  PrayerTimes as AdhanPrayerTimes,
  Madhab,
} from 'adhan';

import type { CalculationMethod, PrayerTimes, PrayerTimesArgs } from './types.js';

const METHOD_MAP: Record<
  CalculationMethod,
  () => ReturnType<typeof AdhanMethod.MuslimWorldLeague>
> = {
  'muslim-world-league': () => AdhanMethod.MuslimWorldLeague(),
  egyptian: () => AdhanMethod.Egyptian(),
  karachi: () => AdhanMethod.Karachi(),
  'umm-al-qura': () => AdhanMethod.UmmAlQura(),
  dubai: () => AdhanMethod.Dubai(),
  qatar: () => AdhanMethod.Qatar(),
  kuwait: () => AdhanMethod.Kuwait(),
  'moon-sighting-committee': () => AdhanMethod.MoonsightingCommittee(),
  singapore: () => AdhanMethod.Singapore(),
  turkey: () => AdhanMethod.Turkey(),
  tehran: () => AdhanMethod.Tehran(),
  'north-america': () => AdhanMethod.NorthAmerica(),
};

const HIGH_LAT_MAP = {
  'middle-of-the-night': AdhanHighLatitudeRule.MiddleOfTheNight,
  'seventh-of-the-night': AdhanHighLatitudeRule.SeventhOfTheNight,
  'twilight-angle': AdhanHighLatitudeRule.TwilightAngle,
} as const;

export function computePrayerTimes(args: PrayerTimesArgs): PrayerTimes {
  const params = METHOD_MAP[args.method]();
  if (args.asrSchool === 'hanafi') params.madhab = Madhab.Hanafi;
  else params.madhab = Madhab.Shafi;
  if (args.highLatitudeRule) params.highLatitudeRule = HIGH_LAT_MAP[args.highLatitudeRule];
  if (args.fajrAngleAdjustment !== undefined) params.adjustments.fajr = args.fajrAngleAdjustment;
  if (args.maghribAngleAdjustment !== undefined)
    params.adjustments.maghrib = args.maghribAngleAdjustment;
  if (args.ishaAngleAdjustment !== undefined) params.adjustments.isha = args.ishaAngleAdjustment;

  const coords = new AdhanCoordinates(args.coordinates.lat, args.coordinates.lng);
  const t: AdhanPrayerTimes = new AdhanPrayerTimes(coords, args.date, params);
  return {
    fajr: t.fajr,
    sunrise: t.sunrise,
    dhuhr: t.dhuhr,
    asr: t.asr,
    maghrib: t.maghrib,
    isha: t.isha,
  };
}

/**
 * The next prayer window starting at or after `now`. Returns the prayer name
 * (lowercase) and its time, or `undefined` if all today's prayers have passed
 * (caller should compute tomorrow's fajr).
 */
export function nextPrayer(
  now: Date,
  times: PrayerTimes,
): { readonly name: keyof PrayerTimes; readonly at: Date } | undefined {
  const order: (keyof PrayerTimes)[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  for (const name of order) {
    if (times[name].getTime() > now.getTime()) {
      return { name, at: times[name] };
    }
  }
  return undefined;
}

/**
 * Adhan-aware scheduling guard: returns true if `instant` falls within the
 * "do not disturb" window around any prayer (default 5 min before fajr/dhuhr/...
 * through 25 min after — covers iqamah + jamaat).
 */
export function isWithinPrayerDnd(
  instant: Date,
  times: PrayerTimes,
  options: { readonly preMs?: number; readonly postMs?: number } = {},
): boolean {
  const pre = options.preMs ?? 5 * 60 * 1000;
  const post = options.postMs ?? 25 * 60 * 1000;
  for (const name of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
    const start = times[name].getTime() - pre;
    const end = times[name].getTime() + post;
    if (instant.getTime() >= start && instant.getTime() <= end) return true;
  }
  return false;
}
