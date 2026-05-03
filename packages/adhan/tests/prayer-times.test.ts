import { describe, expect, it } from 'vitest';

import { computePrayerTimes, isWithinPrayerDnd, nextPrayer } from '../src/prayer-times.js';

describe('computePrayerTimes — Madinah, Umm al-Qura, 2026-05-02', () => {
  const args = {
    date: new Date('2026-05-02T00:00:00.000Z'),
    coordinates: { lat: 24.4683, lng: 39.6142 },
    method: 'umm-al-qura' as const,
    asrSchool: 'shafii' as const,
  };

  const times = computePrayerTimes(args);

  it('produces six valid Date instances in chronological order', () => {
    expect(times.fajr).toBeInstanceOf(Date);
    expect(times.sunrise.getTime()).toBeGreaterThan(times.fajr.getTime());
    expect(times.dhuhr.getTime()).toBeGreaterThan(times.sunrise.getTime());
    expect(times.asr.getTime()).toBeGreaterThan(times.dhuhr.getTime());
    expect(times.maghrib.getTime()).toBeGreaterThan(times.asr.getTime());
    expect(times.isha.getTime()).toBeGreaterThan(times.maghrib.getTime());
  });

  it('switches to Hanafi madhab', () => {
    const hanafi = computePrayerTimes({ ...args, asrSchool: 'hanafi' });
    expect(hanafi.asr.getTime()).toBeGreaterThan(times.asr.getTime());
  });

  it('nextPrayer returns Fajr at midnight', () => {
    const at = new Date(args.date.getTime() + 60_000);
    const next = nextPrayer(at, times);
    expect(next?.name).toBe('fajr');
  });

  it('isWithinPrayerDnd respects pre/post window', () => {
    const justBefore = new Date(times.dhuhr.getTime() - 60_000);
    const justAfter = new Date(times.dhuhr.getTime() + 60_000);
    const wayLater = new Date(times.dhuhr.getTime() + 60 * 60 * 1000);
    expect(isWithinPrayerDnd(justBefore, times)).toBe(true);
    expect(isWithinPrayerDnd(justAfter, times)).toBe(true);
    expect(isWithinPrayerDnd(wayLater, times)).toBe(false);
  });
});
