/**
 * Stub declarations for `moment-hijri` (no upstream types).
 *
 * Only the surface we actually use is typed — extend as new accessors
 * are needed.
 */
declare module 'moment-hijri' {
  import type { Moment } from 'moment';
  // Local Hijri-specific extension on the moment instance.
  interface HijriMoment extends Moment {
    iYear(): number;
    iMonth(): number;
    iDate(): number;
    iDaysInMonth(): number;
    iWeekday(): number;
  }
  function moment(input?: string | Date | number, format?: string): HijriMoment;
  // moment also doubles as a namespace; re-expose the bits we touch.
  namespace moment {
    function locale(name?: string): string;
  }
  export = moment;
}
