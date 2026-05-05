/**
 * Hijri calendar conversion via `moment-hijri`.
 *
 * Months are 1-indexed: Muharram=1 ... Dhul-Hijjah=12.
 */
// moment-hijri ships no upstream types — see ./moment-hijri.d.ts for
// the local stub covering the iYear/iMonth/iDate accessors we use.
import moment from 'moment-hijri';

import type { HijriDate } from './types.js';

const ARABIC_MONTHS: readonly string[] = [
  '',
  'مُحَرَّم',
  'صَفَر',
  'رَبيع الأوّل',
  'رَبيع الآخر',
  'جُمادى الأولى',
  'جُمادى الآخرة',
  'رَجَب',
  'شَعْبان',
  'رَمَضان',
  'شَوّال',
  'ذُو القَعدة',
  'ذُو الحِجّة',
];

const ENGLISH_MONTHS: readonly string[] = [
  '',
  'Muharram',
  'Safar',
  "Rabi' al-awwal",
  "Rabi' al-thani",
  'Jumada al-awwal',
  'Jumada al-thani',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  "Dhu al-Qa'dah",
  'Dhu al-Hijjah',
];

/** Convert a Gregorian Date to its hijri equivalent (Umm al-Qura by default). */
export function toHijri(date: Date): HijriDate {
  const m = moment(date);
  const day = m.iDate();
  const month = m.iMonth() + 1; // moment-hijri months are 0-indexed
  const year = m.iYear();
  return {
    day,
    month,
    year,
    monthNameArabic: ARABIC_MONTHS[month] ?? '',
    monthNameEnglish: ENGLISH_MONTHS[month] ?? '',
  };
}

/** Today's hijri date in UTC. */
export function todayHijri(): HijriDate {
  return toHijri(new Date());
}

/** True if `date` falls within Ramadan. */
export function isRamadan(date: Date): boolean {
  return toHijri(date).month === 9;
}

/** True if `date` is one of the last 10 nights of Ramadan. */
export function isLastTenNightsOfRamadan(date: Date): boolean {
  const h = toHijri(date);
  return h.month === 9 && h.day >= 21;
}
