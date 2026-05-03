# `@qalaam/adhan`

Adhan (prayer-time) calculation, qibla bearing, hijri calendar — typed Qalaam API over the open-source `adhan` (Batoul Apps, MIT) and `moment-hijri` libraries. Per strategy §10.4.

## Why this exists

The smart-home announcement engine needs to know:

1. When the next prayer window begins (so Hifdh sessions don't overlap it).
2. Where Qibla points (for the prayer-room widget).
3. Today's hijri date (for Ramadan-aware UI mode, Friday Surah Kahf nudge, Eid).

This package centralizes those calculations behind a stable, mushaf-agnostic API.

## Use

```ts
import { computePrayerTimes, qiblaBearing, todayHijri } from '@qalaam/adhan';

const times = computePrayerTimes({
  date: new Date('2026-05-02'),
  coordinates: { lat: 24.4683, lng: 39.6142 }, // Madinah
  method: 'umm-al-qura',
  asrSchool: 'shafii',
});

const bearing = qiblaBearing({ lat: 51.5074, lng: -0.1278 }); // London → ~119°

const { day, month, year } = todayHijri();
```
