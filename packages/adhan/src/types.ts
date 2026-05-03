/**
 * Public types for `@qalaam/adhan`. Stable across minor versions.
 */

export interface Coordinates {
  /** Decimal degrees, north positive. */
  readonly lat: number;
  /** Decimal degrees, east positive. */
  readonly lng: number;
}

/**
 * Calculation methods supported by the underlying `adhan` library.
 * See https://github.com/batoulapps/adhan-js#calculation-methods
 */
export type CalculationMethod =
  | 'muslim-world-league'
  | 'egyptian'
  | 'karachi'
  | 'umm-al-qura'
  | 'dubai'
  | 'qatar'
  | 'kuwait'
  | 'moon-sighting-committee'
  | 'singapore'
  | 'turkey'
  | 'tehran'
  | 'north-america';

export type AsrSchool = 'shafii' | 'hanafi';

export type HighLatitudeRule =
  | 'middle-of-the-night'
  | 'seventh-of-the-night'
  | 'twilight-angle';

export interface PrayerTimesArgs {
  readonly date: Date;
  readonly coordinates: Coordinates;
  readonly method: CalculationMethod;
  readonly asrSchool?: AsrSchool;
  readonly highLatitudeRule?: HighLatitudeRule;
  readonly fajrAngleAdjustment?: number;
  readonly maghribAngleAdjustment?: number;
  readonly ishaAngleAdjustment?: number;
}

export interface PrayerTimes {
  readonly fajr: Date;
  readonly sunrise: Date;
  readonly dhuhr: Date;
  readonly asr: Date;
  readonly maghrib: Date;
  readonly isha: Date;
}

export interface HijriDate {
  /** Hijri day-of-month, 1-30. */
  readonly day: number;
  /** Hijri month index, 1-12. */
  readonly month: number;
  /** Hijri year. */
  readonly year: number;
  /** Localized month name (Arabic). */
  readonly monthNameArabic: string;
  /** Localized month name (English). */
  readonly monthNameEnglish: string;
}
