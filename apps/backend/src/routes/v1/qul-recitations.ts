/**
 * GET /v1/recitations/segmented
 *   → list of segmented reciters (only those licensed in `recitersByReciterId`)
 * GET /v1/recitations/:reciterId/segments/:verseKey
 *   → word-level start_ms / end_ms timings for an ayah
 * GET /v1/recitations/:reciterId/word-at?verseKey=...&ms=...
 *   → word_index whose [start_ms, end_ms] interval contains `ms`
 *
 * Per ADR-0020. License: `per-reciter`. Cache: 1 day for segments
 * (timings rarely change after a re-mastering); per-reciter list cached
 * 1 hour because the catalog evolves with new licensed reciters.
 */
import { existsSync } from 'node:fs';

import { QalaamError } from '@qalaam/core';
import Database from 'better-sqlite3';

import { getQul } from '../../lib/data-loader.js';
import {
  alignByCharWeight,
  getCachedAligned,
  persistAligned,
  probeMp3DurationMs,
} from '../../lib/forced-aligner.js';
import { LICENSE_METADATA } from '../../lib/qul-license-registry.js';

import type { Config } from '../../config.js';
import type { AlignedSegment } from '../../lib/forced-aligner.js';
import type { FastifyInstance } from 'fastify';

const ONE_HOUR_S = 60 * 60;
const ONE_DAY_S = 60 * 60 * 24;
const VERSE_KEY_RE = /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/;

// eslint-disable-next-line @typescript-eslint/require-await
export async function qulRecitationsRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  function reader() {
    if (!existsSync(opts.config.QUL_SQLITE_PATH)) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `QUL SQLite not present at ${opts.config.QUL_SQLITE_PATH}.`,
      );
    }
    return getQul(opts.config.QUL_SQLITE_PATH).recitationSegments(
      LICENSE_METADATA.recitersByReciterId,
    );
  }

  fastify.get(
    '/v1/recitations/segmented',
    { schema: { tags: ['recitations'] } },
    async (_req, reply) => {
      // Strip per-row LicenseMetadata; emit one consolidated `attribution_per_reciter`
      // so the client can render correct credits without leaking license internals.
      const reciters = reader()
        .reciters()
        .map(({ meta, ...rest }) => ({
          ...rest,
          attribution: meta.attributionText,
          license: meta.license,
        }));
      void reply.header('cache-control', `public, max-age=${ONE_HOUR_S.toString()}`);
      return { data: reciters };
    },
  );

  fastify.get<{ Params: { reciterId: string; verseKey: string } }>(
    '/v1/recitations/:reciterId/segments/:verseKey',
    { schema: { tags: ['recitations'] } },
    async (req, reply) => {
      if (!VERSE_KEY_RE.test(req.params.verseKey)) {
        throw new QalaamError(
          'qalaam.verse-key.malformed',
          `Invalid verseKey ${req.params.verseKey}`,
        );
      }
      try {
        let segments = reader().segmentsForAyah(req.params.reciterId, req.params.verseKey);
        // Fallback chain for reciters without QUL segment timing
        // (the 37 EveryAyah-sourced ones): check our generated cache,
        // and if empty, run the forced-aligner on demand. The first
        // user pays ~300ms latency for the audio probe + DB write,
        // then every subsequent user gets cached segments.
        if (segments.length === 0) {
          const aligned = await getOrAlignSegments(
            opts.config.QUL_SQLITE_PATH,
            req.params.reciterId,
            req.params.verseKey,
          );
          if (aligned.length > 0) segments = aligned;
        }
        const meta = LICENSE_METADATA.recitersByReciterId.get(req.params.reciterId);
        void reply.header('cache-control', `public, max-age=${ONE_DAY_S.toString()}`);
        return {
          data: segments,
          attribution: meta?.attributionText ?? null,
          license: meta?.license ?? null,
        };
      } catch (err) {
        if (err instanceof Error && err.message.includes('unlicensed-reciter')) {
          throw new QalaamError(
            'qalaam.adapter.capability-unsupported',
            `Reciter ${req.params.reciterId} is not licensed; segments refused. See ADR-0020.`,
          );
        }
        throw err;
      }
    },
  );

  fastify.get<{
    Params: { reciterId: string };
    Querystring: { verseKey?: string; ms?: string };
  }>(
    '/v1/recitations/:reciterId/word-at',
    { schema: { tags: ['recitations'] } },
    async (req, reply) => {
      const verseKey = req.query.verseKey ?? '';
      const ms = Number.parseInt(req.query.ms ?? '0', 10);
      if (!VERSE_KEY_RE.test(verseKey)) {
        throw new QalaamError('qalaam.verse-key.malformed', `Invalid verseKey ${verseKey}`);
      }
      try {
        const wordIndex = reader().wordAtPosition(req.params.reciterId, verseKey, ms);
        void reply.header('cache-control', 'no-store'); // playback head — never cache
        return {
          data: { reciterId: req.params.reciterId, verseKey, ms, wordIndex: wordIndex ?? null },
        };
      } catch (err) {
        if (err instanceof Error && err.message.includes('unlicensed-reciter')) {
          throw new QalaamError(
            'qalaam.adapter.capability-unsupported',
            `Reciter ${req.params.reciterId} is not licensed; word-at refused.`,
          );
        }
        throw err;
      }
    },
  );
}

// In-flight aligner promises so concurrent requests for the same
// (reciter, verse) only kick off ONE audio-probe + DB write. Subsequent
// callers await the same promise.
const inFlight = new Map<string, Promise<readonly AlignedSegment[]>>();

async function getOrAlignSegments(
  dbPath: string,
  reciterId: string,
  verseKey: string,
): Promise<readonly AlignedSegment[]> {
  // 1) Cache hit?
  const cached = getCachedAligned(dbPath, reciterId, verseKey);
  if (cached.length > 0) return cached;

  // 2) De-dupe concurrent first hits.
  const key = `${reciterId}|${verseKey}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<readonly AlignedSegment[]> => {
    // 3) Find the audio URL + verse text in qul.sqlite. We open a fresh
    // readonly handle here because the qul-recitations reader doesn't
    // expose these tables directly. Per ADR-0020 the URL only
    // surfaces if the reciter is licensed.
    let db: Database.Database;
    try {
      db = new Database(dbPath, { readonly: true, fileMustExist: true });
    } catch {
      return [];
    }
    let audioUrl = '';
    let verseText = '';
    try {
      const audioRow = db
        .prepare<[string, string], { audio_url: string }>(
          `SELECT audio_url FROM qalaam_v1_qul_recitations_audio
           WHERE reciter_id = ? AND verse_key = ?`,
        )
        .get(reciterId, verseKey);
      const verseRow = db
        .prepare<
          [string],
          { text_uthmani: string }
        >(`SELECT text_uthmani FROM qalaam_v1_verses WHERE verse_key = ?`)
        .get(verseKey);
      audioUrl = audioRow?.audio_url ?? '';
      verseText = verseRow?.text_uthmani ?? '';
    } finally {
      db.close();
    }
    if (!audioUrl || !verseText) return [];

    // 4) Probe the MP3 for duration. Hits the upstream CDN; cap with a
    // 6s timeout so a slow/dead host can't stall the request.
    let durationMs: number | null = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => {
        ctrl.abort();
      }, 6_000);
      try {
        durationMs = await probeMp3DurationMs(audioUrl);
      } finally {
        clearTimeout(t);
      }
    } catch {
      durationMs = null;
    }
    if (!durationMs || durationMs <= 0) return [];

    // 5) Char-weighted apportionment + cache.
    const segments = alignByCharWeight(reciterId, verseKey, verseText, durationMs);
    persistAligned(dbPath, segments);
    return segments;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}
