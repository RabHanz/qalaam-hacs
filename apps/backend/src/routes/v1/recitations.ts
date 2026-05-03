/**
 * GET /v1/recitations → list of reciters Qalaam supports.
 * GET /v1/audio/by_verse/:verseKey/:reciter → resolved audio URL + word segments.
 *
 * v0.1: returns a small canonical seed (Mishary, Husary, Abdul Basit). The
 * v0.5 wiring fetches from QUL `chapter_reciters` + audio_segments, with QF
 * API fallback for reciter+ayah pairs QUL hasn't covered.
 */
import { QalaamError, parseVerseKey } from '@qalaam/core';
import type { FastifyInstance } from 'fastify';

interface ReciterRow {
  readonly id: string;
  readonly slug: string;
  readonly name: { en: string; ar: string };
  readonly style: 'murattal' | 'mujawwad';
  readonly riwayah: 'hafs' | 'warsh';
  readonly everyayahKey: string;
}

const SEED_RECITERS: readonly ReciterRow[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'mishary-alafasy',
    name: { en: 'Mishary Rashid Alafasy', ar: 'مشاري بن راشد العفاسي' },
    style: 'murattal',
    riwayah: 'hafs',
    everyayahKey: 'Alafasy_128kbps',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'mahmoud-khalil-husary',
    name: { en: 'Mahmoud Khalil Al-Husary', ar: 'محمود خليل الحصري' },
    style: 'murattal',
    riwayah: 'hafs',
    everyayahKey: 'Husary_128kbps',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    slug: 'abdul-basit-abd-as-samad',
    name: { en: 'Abdul Basit Abd as-Samad', ar: 'عبد الباسط عبد الصمد' },
    style: 'murattal',
    riwayah: 'hafs',
    everyayahKey: 'Abdul_Basit_Murattal_64kbps',
  },
];

export async function recitationsRoutes(fastify: FastifyInstance): Promise<void> {
  const handler = async (
    _request: unknown,
    reply: { header: (k: string, v: string) => unknown },
  ): Promise<{ reciters: readonly ReciterRow[]; api_version: string }> => {
    void reply.header('cache-control', 'public, max-age=86400');
    return { reciters: SEED_RECITERS, api_version: '0.0.1' };
  };

  fastify.get(
    '/v1/recitations',
    { schema: { description: 'List supported reciters.', tags: ['recitations'] } },
    handler,
  );

  // HA coordinator alias.
  fastify.get(
    '/v1/reciters',
    {
      schema: {
        description: 'Alias of /v1/recitations for the HA coordinator.',
        tags: ['recitations'],
      },
    },
    handler,
  );

  fastify.get<{ Params: { verseKey: string; reciter: string } }>(
    '/v1/audio/by_verse/:verseKey/:reciter',
    {
      schema: {
        description:
          'Per-ayah audio URL for a reciter — resolves to everyayah.com or audio.qurancdn.com.',
        tags: ['recitations'],
        params: {
          type: 'object',
          properties: {
            verseKey: { type: 'string', pattern: '^[0-9]+:[0-9]+$' },
            reciter: { type: 'string', pattern: '^[a-z0-9-]+$' },
          },
          required: ['verseKey', 'reciter'],
        },
      },
    },
    async (request, reply) => {
      const key = parseVerseKey(request.params.verseKey);
      const reciter = SEED_RECITERS.find((r) => r.slug === request.params.reciter);
      if (!reciter) {
        throw new QalaamError(
          'qalaam.data.not-loaded',
          `Unknown reciter slug: ${request.params.reciter}. Try 'mishary-alafasy'.`,
          { outcomeImpacted: 'O-06' },
        );
      }
      // everyayah.com URL pattern: <reciter_key>/<surah:003><ayah:003>.mp3
      const [surah, ayah] = key.split(':') as [string, string];
      const padded = `${surah.padStart(3, '0')}${ayah.padStart(3, '0')}`;
      const audioUrl = `https://everyayah.com/data/${reciter.everyayahKey}/${padded}.mp3`;
      void reply.header('cache-control', 'public, max-age=2592000'); // 30 days — audio is immutable
      return {
        verseKey: key,
        reciterSlug: reciter.slug,
        audioUrl,
        wordSegments: [],
        source: 'everyayah',
      };
    },
  );
}
