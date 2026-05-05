/**
 * GET /v1/prayer-times?lat=&lon=&date=&method=&asr_school=&high_lat_rule=
 *
 * Returns the 5 daily prayer times + sunrise + (Imsak inferred from
 * Fajr - 10min) for a given location/date/method. Backed by
 * `@qalaam/adhan` which wraps Batoul Apps' MIT-licensed `adhan` lib.
 *
 * Methods supported: muslim-world-league, egyptian, karachi, umm-al-qura,
 * dubai, qatar, kuwait, singapore, turkey, tehran, north-america,
 * moon-sighting-committee. Plus high-latitude rules.
 *
 * GET /v1/prayer-times/methods → enumerates all supported methods +
 * their default angles (so the /salah page can render a method picker).
 */
import { type CalculationMethod, computePrayerTimes, type HighLatitudeRule } from '@qalaam/adhan';

import type { FastifyInstance } from 'fastify';

const ALL_METHODS: readonly CalculationMethod[] = [
  'muslim-world-league',
  'egyptian',
  'karachi',
  'umm-al-qura',
  'dubai',
  'qatar',
  'kuwait',
  'moon-sighting-committee',
  'singapore',
  'turkey',
  'tehran',
  'north-america',
];

const ALL_HIGH_LAT_RULES: readonly HighLatitudeRule[] = [
  'middle-of-the-night',
  'seventh-of-the-night',
  'twilight-angle',
];

// eslint-disable-next-line @typescript-eslint/require-await -- fastify register signature requires Promise<void>; body does not await.
export async function prayerTimesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/v1/prayer-times/methods', { schema: { tags: ['prayer-times'] } }, (_req, reply) => {
    void reply.header('cache-control', 'public, max-age=86400');
    return reply.send({
      methods: ALL_METHODS.map((m) => ({
        id: m,
        label: m
          .split('-')
          .map((w) => `${w[0]?.toUpperCase() ?? ''}${w.slice(1)}`)
          .join(' '),
      })),
      highLatitudeRules: ALL_HIGH_LAT_RULES.map((r) => ({
        id: r,
        label: r.split('-').join(' '),
      })),
      asrSchools: [
        { id: 'shafii', label: 'Shafiʿi / Hanbali / Maliki' },
        { id: 'hanafi', label: 'Hanafi' },
      ],
    });
  });

  fastify.get<{
    Querystring: {
      lat: string;
      lon: string;
      date?: string;
      method?: string;
      asr_school?: string;
      high_lat_rule?: string;
    };
  }>(
    '/v1/prayer-times',
    {
      schema: {
        description: 'Compute prayer times for a location/date/method.',
        tags: ['prayer-times'],
        querystring: {
          type: 'object',
          properties: {
            lat: { type: 'string', pattern: '^-?[0-9]+(\\.[0-9]+)?$' },
            lon: { type: 'string', pattern: '^-?[0-9]+(\\.[0-9]+)?$' },
            date: { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
            method: { type: 'string' },
            asr_school: { type: 'string', enum: ['shafi', 'hanafi'] },
            high_lat_rule: { type: 'string' },
          },
          required: ['lat', 'lon'],
        },
      },
    },
    (req, reply) => {
      const lat = Number.parseFloat(req.query.lat);
      const lon = Number.parseFloat(req.query.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return reply.code(400).send({ error: 'qalaam.prayer-times.bad-coords' });
      }
      const date = req.query.date ? new Date(req.query.date) : new Date();
      const methodRaw = req.query.method ?? 'muslim-world-league';
      const method: CalculationMethod = ALL_METHODS.includes(methodRaw as CalculationMethod)
        ? (methodRaw as CalculationMethod)
        : 'muslim-world-league';
      const asrSchool: 'shafii' | 'hanafi' =
        req.query.asr_school === 'hanafi' ? 'hanafi' : 'shafii';
      const highLatRaw = req.query.high_lat_rule;
      const highLatitudeRule: HighLatitudeRule | undefined =
        highLatRaw && ALL_HIGH_LAT_RULES.includes(highLatRaw as HighLatitudeRule)
          ? (highLatRaw as HighLatitudeRule)
          : undefined;
      try {
        const baseArgs = {
          coordinates: { lat, lng: lon },
          date,
          method,
          asrSchool,
        };
        const args = highLatitudeRule ? { ...baseArgs, highLatitudeRule } : baseArgs;
        const times = computePrayerTimes(args);
        // Imsak = Fajr - 10 minutes (a conservative classical approximation).
        const imsak = new Date(times.fajr.getTime() - 10 * 60_000);
        void reply.header('cache-control', 'public, max-age=300');
        return reply.send({
          location: { latitude: lat, longitude: lon },
          date: date.toISOString().slice(0, 10),
          method,
          asrSchool,
          highLatitudeRule: highLatitudeRule ?? null,
          times: {
            imsak: imsak.toISOString(),
            fajr: times.fajr.toISOString(),
            sunrise: times.sunrise.toISOString(),
            dhuhr: times.dhuhr.toISOString(),
            asr: times.asr.toISOString(),
            maghrib: times.maghrib.toISOString(),
            isha: times.isha.toISOString(),
          },
        });
      } catch (err) {
        return reply.code(500).send({
          error: 'qalaam.prayer-times.compute-failed',
          message: (err as Error).message,
        });
      }
    },
  );
}
