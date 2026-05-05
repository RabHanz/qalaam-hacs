/**
 * GET /v1/qibla?lat=&lon=  → great-circle bearing from (lat,lon) to the Kaaba
 * GET /v1/hijri/today      → today's Hijri date + Ramadan/last-10-nights flags
 * GET /v1/hijri/at?date=   → Hijri date for an arbitrary Gregorian date
 *
 * Backed by `@qalaam/adhan` (qiblaBearing + toHijri + todayHijri).
 */
import {
  isLastTenNightsOfRamadan,
  isRamadan,
  qiblaBearing,
  todayHijri,
  toHijri,
} from '@qalaam/adhan';

import type { FastifyInstance } from 'fastify';

export async function qiblaHijriRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { lat: string; lon: string } }>(
    '/v1/qibla',
    {
      schema: {
        description: 'Great-circle bearing from a location to the Kaaba.',
        tags: ['companion'],
        querystring: {
          type: 'object',
          properties: {
            lat: { type: 'string', pattern: '^-?[0-9]+(\\.[0-9]+)?$' },
            lon: { type: 'string', pattern: '^-?[0-9]+(\\.[0-9]+)?$' },
          },
          required: ['lat', 'lon'],
        },
      },
    },
    (req, reply) => {
      const lat = Number.parseFloat(req.query.lat);
      const lon = Number.parseFloat(req.query.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return reply.code(400).send({ error: 'qalaam.qibla.bad-coords' });
      }
      const bearing = qiblaBearing({ lat, lng: lon });
      void reply.header('cache-control', 'public, max-age=86400');
      return reply.send({
        location: { latitude: lat, longitude: lon },
        kaaba: { latitude: 21.4225, longitude: 39.8262 },
        bearingDegrees: bearing,
        bearingCompass: cardinalLabel(bearing),
      });
    },
  );

  fastify.get('/v1/hijri/today', { schema: { tags: ['companion'] } }, (_req, reply) => {
    const today = new Date();
    const hijri = todayHijri();
    void reply.header('cache-control', 'public, max-age=3600');
    return reply.send({
      gregorian: today.toISOString().slice(0, 10),
      hijri,
      isRamadan: isRamadan(today),
      isLastTenNightsOfRamadan: isLastTenNightsOfRamadan(today),
      events: islamicEventsFor(hijri),
    });
  });

  fastify.get<{ Querystring: { date: string } }>(
    '/v1/hijri/at',
    {
      schema: {
        description: 'Hijri date for an arbitrary Gregorian date.',
        tags: ['companion'],
        querystring: {
          type: 'object',
          properties: {
            date: { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
          },
          required: ['date'],
        },
      },
    },
    (req, reply) => {
      const d = new Date(req.query.date);
      if (Number.isNaN(d.getTime())) {
        return reply.code(400).send({ error: 'qalaam.hijri.bad-date' });
      }
      const hijri = toHijri(d);
      void reply.header('cache-control', 'public, max-age=86400');
      return reply.send({
        gregorian: d.toISOString().slice(0, 10),
        hijri,
        isRamadan: isRamadan(d),
        isLastTenNightsOfRamadan: isLastTenNightsOfRamadan(d),
        events: islamicEventsFor(hijri),
      });
    },
  );
}

function cardinalLabel(bearing: number): string {
  // 16-point compass (NE, ENE, …) for a richer UX than the 8-point.
  const labels = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const i = Math.round(((bearing % 360) + 360) / 22.5) % 16;
  return labels[i] ?? 'N';
}

interface HijriDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly monthArabic?: string;
  readonly monthEnglish?: string;
}

interface IslamicEvent {
  readonly name: string;
  readonly nameAr: string;
  readonly significance: 'major' | 'minor' | 'observance';
}

function islamicEventsFor(h: HijriDate): readonly IslamicEvent[] {
  const out: IslamicEvent[] = [];
  // 10 Muharram — Ashura
  if (h.month === 1 && h.day === 10) {
    out.push({ name: 'Ashura', nameAr: 'عاشوراء', significance: 'major' });
  }
  // 12 Rabi-al-Awwal — Mawlid (observed by some)
  if (h.month === 3 && h.day === 12) {
    out.push({ name: 'Mawlid an-Nabi', nameAr: 'المولد النبوي', significance: 'observance' });
  }
  // 15 Sha'ban — Laylat al-Bara'ah
  if (h.month === 8 && h.day === 15) {
    out.push({ name: "Laylat al-Bara'ah", nameAr: 'ليلة البراءة', significance: 'minor' });
  }
  // 1 Ramadan
  if (h.month === 9 && h.day === 1) {
    out.push({ name: 'First of Ramadan', nameAr: 'أول رمضان', significance: 'major' });
  }
  // Last 10 nights of Ramadan — odd nights are Laylat al-Qadr candidates
  if (h.month === 9 && h.day >= 21 && h.day % 2 === 1) {
    out.push({ name: 'Laylat al-Qadr (candidate)', nameAr: 'ليلة القدر', significance: 'major' });
  }
  // 1 Shawwal — Eid al-Fitr
  if (h.month === 10 && h.day === 1) {
    out.push({ name: 'Eid al-Fitr', nameAr: 'عيد الفطر', significance: 'major' });
  }
  // 8-13 Dhu al-Hijjah — Hajj days
  if (h.month === 12 && h.day >= 8 && h.day <= 13) {
    if (h.day === 9) {
      out.push({ name: 'Day of Arafah', nameAr: 'يوم عرفة', significance: 'major' });
    } else if (h.day === 10) {
      out.push({ name: 'Eid al-Adha', nameAr: 'عيد الأضحى', significance: 'major' });
    } else {
      out.push({ name: 'Days of Tashreeq / Hajj', nameAr: 'أيام التشريق', significance: 'minor' });
    }
  }
  return out;
}
